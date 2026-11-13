import { HttpError } from '../middleware/error.js';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const BUCKET_NAME =
  process.env.SUPABASE_LEGAL_DOCUMENTS_BUCKET ??
  'hospital-legal-documents';
let bucketSetup: Promise<void> | undefined;

function storageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new HttpError(
      'Supabase Storage is not configured for legal-document uploads.',
      503,
    );
  }
  return { supabaseUrl, serviceKey };
}

function bucketEndpoint(supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(BUCKET_NAME)}`;
}

function storageHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
  };
}

async function ensurePrivateBucket(): Promise<void> {
  const { supabaseUrl, serviceKey } = storageConfig();
  const headers = storageHeaders(serviceKey);
  let response: Response;
  try {
    response = await fetch(bucketEndpoint(supabaseUrl), { headers });
  } catch (error) {
    console.error('Could not inspect the legal-document storage bucket.', error);
    throw new HttpError('Supabase Storage could not be reached.', 503);
  }

  if (response.status === 404) {
    try {
      response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: BUCKET_NAME,
          name: BUCKET_NAME,
          public: false,
          file_size_limit: MAX_DOCUMENT_BYTES,
          allowed_mime_types: ['application/pdf'],
        }),
      });
    } catch (error) {
      console.error('Could not create the legal-document storage bucket.', error);
      throw new HttpError('Supabase Storage could not be reached.', 503);
    }
    if (response.status === 409) {
      try {
        response = await fetch(bucketEndpoint(supabaseUrl), { headers });
      } catch (error) {
        console.error('Could not verify the legal-document storage bucket.', error);
        throw new HttpError('Supabase Storage could not be reached.', 503);
      }
    } else if (response.ok) {
      return;
    } else {
      console.error(
        'Could not create the legal-document storage bucket.',
        response.status,
      );
      throw new HttpError('Supabase Storage bucket setup failed.', 503);
    }
  }

  if (!response.ok) {
    console.error(
      'Could not inspect the legal-document storage bucket.',
      response.status,
    );
    throw new HttpError('Supabase Storage bucket setup failed.', 503);
  }

  const bucket = (await response.json()) as {
    public?: unknown;
    file_size_limit?: unknown;
    allowed_mime_types?: unknown;
  };
  if (
    bucket.public !== false ||
    bucket.file_size_limit !== MAX_DOCUMENT_BYTES ||
    !Array.isArray(bucket.allowed_mime_types) ||
    bucket.allowed_mime_types.length !== 1 ||
    bucket.allowed_mime_types[0] !== 'application/pdf'
  ) {
    throw new HttpError(
      `Supabase bucket "${BUCKET_NAME}" must be private, limited to 10 MiB, and restricted to PDF files.`,
      503,
    );
  }
}

async function ensureBucket(): Promise<void> {
  if (!bucketSetup) {
    bucketSetup = ensurePrivateBucket().catch((error: unknown) => {
      bucketSetup = undefined;
      throw error;
    });
  }
  await bucketSetup;
}

function encodedPath(storagePath: string): string {
  return storagePath.split('/').map(encodeURIComponent).join('/');
}

export async function uploadLegalDocument(
  storagePath: string,
  file: Express.Multer.File,
): Promise<void> {
  if (file.mimetype !== 'application/pdf' || file.size > MAX_DOCUMENT_BYTES) {
    throw new HttpError('Documents must be PDF files no larger than 10 MB.', 400);
  }
  if (file.buffer.length < 5 || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new HttpError('The uploaded file is not a valid PDF.', 400);
  }

  await ensureBucket();
  const { supabaseUrl, serviceKey } = storageConfig();
  const body = new ArrayBuffer(file.buffer.byteLength);
  new Uint8Array(body).set(file.buffer);
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/storage/v1/object/${encodeURIComponent(BUCKET_NAME)}/${encodedPath(storagePath)}`,
      {
        method: 'POST',
        headers: {
          ...storageHeaders(serviceKey),
          'Content-Type': 'application/pdf',
          'x-upsert': 'false',
        },
        body,
      },
    );
  } catch (error) {
    console.error('Could not upload a legal document to Supabase Storage.', error);
    throw new HttpError('Supabase Storage could not be reached.', 503);
  }
  if (!response.ok) {
    console.error('Legal-document upload failed.', response.status);
    throw new HttpError('The legal document could not be stored.', 502);
  }
}

export async function removeLegalDocuments(
  storagePaths: string[],
): Promise<void> {
  if (storagePaths.length === 0) return;
  const { supabaseUrl, serviceKey } = storageConfig();
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/storage/v1/object/${encodeURIComponent(BUCKET_NAME)}`,
      {
        method: 'DELETE',
        headers: { ...storageHeaders(serviceKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: storagePaths }),
      },
    );
  } catch (error) {
    console.error('Could not clean up uploaded legal documents.', error);
    throw new HttpError('Supabase Storage cleanup failed.', 502);
  }
  if (!response.ok) {
    console.error('Legal-document cleanup failed.', response.status);
    throw new HttpError('Supabase Storage cleanup failed.', 502);
  }
}

export async function createLegalDocumentUrl(
  storagePath: string,
): Promise<string> {
  await ensureBucket();
  const { supabaseUrl, serviceKey } = storageConfig();
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(BUCKET_NAME)}/${encodedPath(storagePath)}`,
      {
        method: 'POST',
        headers: { ...storageHeaders(serviceKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 300 }),
      },
    );
  } catch (error) {
    console.error('Could not create a signed legal-document URL.', error);
    throw new HttpError('Supabase Storage could not be reached.', 503);
  }
  if (!response.ok) {
    console.error('Legal-document URL signing failed.', response.status);
    throw new HttpError('The legal document could not be opened.', 502);
  }

  const result = (await response.json()) as { signedURL?: unknown };
  if (typeof result.signedURL !== 'string') {
    throw new HttpError('Supabase Storage returned an invalid signed URL.', 502);
  }
  const relativePath = result.signedURL.startsWith('/')
    ? result.signedURL
    : `/${result.signedURL}`;
  return `${supabaseUrl}/storage/v1${relativePath.startsWith('/storage/v1') ? relativePath.slice('/storage/v1'.length) : relativePath}`;
}
