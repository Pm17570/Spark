'use client';
import { createContext, useContext } from 'react';
export const StaffContext = createContext({ role: 'admin', name: '' });
export const useStaff = () => useContext(StaffContext);
