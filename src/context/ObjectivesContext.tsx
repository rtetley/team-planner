import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { objectivesApi } from '../api';
import { Objective } from '../types';

interface ObjectivesContextType {
  objectives: Objective[];
  addObjective: (objective: Objective) => void;
  updateObjective: (updated: Objective) => void;
}

const ObjectivesContext = createContext<ObjectivesContextType | null>(null);

export function ObjectivesProvider({ children }: { children: ReactNode }) {
  const [objectives, setObjectives] = useState<Objective[]>([]);

  useEffect(() => {
    objectivesApi.getAll().then(setObjectives).catch(console.error);
  }, []);

  const addObjective = (objective: Objective) => {
    setObjectives((prev) => [...prev, objective]);
    objectivesApi.create(objective as Omit<Objective, 'id'>).catch(console.error);
  };

  const updateObjective = (updated: Objective) => {
    setObjectives((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    objectivesApi.update(updated).catch(console.error);
  };

  return (
    <ObjectivesContext.Provider value={{ objectives, addObjective, updateObjective }}>
      {children}
    </ObjectivesContext.Provider>
  );
}

export function useObjectives() {
  const context = useContext(ObjectivesContext);
  if (!context) throw new Error('useObjectives must be used within ObjectivesProvider');
  return context;
}
