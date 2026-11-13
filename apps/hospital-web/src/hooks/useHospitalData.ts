import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, hospitalApi } from '../services/api';
import type {
  AuditLog,
  BedInventory,
  Doctor,
  Hospital,
  HospitalPanelSession,
} from '../types';

const POLL_INTERVAL_MS = 30_000;

export interface HospitalData {
  hospital: Hospital | null;
  beds: BedInventory[];
  doctors: Doctor[];
  auditLogs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateBed: (
    bedId: string,
    operation: 'increment' | 'decrement',
  ) => Promise<boolean>;
  saveDoctor: (
    doctor: Parameters<typeof hospitalApi.saveDoctor>[1],
  ) => Promise<boolean>;
}

export function useHospitalData(session: HospitalPanelSession): HospitalData {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [beds, setBeds] = useState<BedInventory[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    try {
      const [nextHospital, nextBeds, nextDoctors, nextAuditLogs] =
        await Promise.all([
          hospitalApi.getHospital(session.hospitalId),
          hospitalApi.getBeds(session.hospitalId),
          hospitalApi.getDoctors(session.hospitalId),
          hospitalApi.getAuditLogs(session.hospitalId, session),
        ]);
      if (requestId.current !== currentRequestId) return;
      setHospital(nextHospital);
      setBeds(nextBeds);
      setDoctors(nextDoctors);
      setAuditLogs(nextAuditLogs);
      setError(null);
    } catch (requestError) {
      if (requestId.current !== currentRequestId) return;
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to load hospital operations data.',
      );
    } finally {
      if (requestId.current === currentRequestId) setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(
      () => void refresh(),
      POLL_INTERVAL_MS,
    );
    return () => {
      window.clearInterval(intervalId);
      requestId.current += 1;
    };
  }, [refresh]);

  const updateBed = useCallback(
    async (
      bedId: string,
      operation: 'increment' | 'decrement',
    ): Promise<boolean> => {
      const current = beds.find((bed) => bed.id === bedId);
      if (!current) return false;
      const nextCount =
        current.availableCount + (operation === 'increment' ? 1 : -1);
      if (nextCount < 0 || nextCount > current.totalCount) return false;

      const previous = current;
      const optimistic: BedInventory = {
        ...current,
        availableCount: nextCount,
        statusCode:
          nextCount === 0
            ? 'FULL'
            : nextCount / current.totalCount <= 0.2
              ? 'LIMITED'
              : 'HIGH_AVAILABILITY',
        lastUpdatedAt: new Date().toISOString(),
      };
      setBeds((items) =>
        items.map((bed) => (bed.id === bedId ? optimistic : bed)),
      );
      setError(null);

      try {
        const confirmed = await hospitalApi.updateBeds(
          session.hospitalId,
          current,
          operation,
          session,
        );
        setBeds((items) =>
          items.map((bed) => (bed.id === bedId ? confirmed : bed)),
        );
        void refresh();
        return true;
      } catch (requestError) {
        setBeds((items) =>
          items.map((bed) => (bed.id === bedId ? previous : bed)),
        );
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'Could not update bed availability. The previous count was restored.',
        );
        void refresh();
        return false;
      }
    },
    [beds, refresh, session],
  );

  const saveDoctor = useCallback(
    async (
      doctor: Parameters<typeof hospitalApi.saveDoctor>[1],
    ): Promise<boolean> => {
      try {
        const saved = await hospitalApi.saveDoctor(
          session.hospitalId,
          doctor,
          session,
        );
        setDoctors((items) => {
          const exists = items.some((item) => item.id === saved.id);
          return exists
            ? items.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...items];
        });
        setError(null);
        void refresh();
        return true;
      } catch (requestError) {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : 'Could not save doctor details. Please try again.',
        );
        return false;
      }
    },
    [refresh, session],
  );

  return {
    hospital,
    beds,
    doctors,
    auditLogs,
    isLoading,
    error,
    refresh,
    updateBed,
    saveDoctor,
  };
}
