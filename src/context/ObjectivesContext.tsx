import { createContext, useContext, useState, ReactNode } from 'react';
import { mockObjectives } from '../data/mockData';
import { Objective } from '../types';

interface ObjectivesContextType {
  objectives: Objective[];
  updateObjective: (updated: Objective) => void;
}

const ObjectivesContext = createContext<ObjectivesContextType | null>(null);

export function ObjectivesProvider({ children }: { children: ReactNode }) {
  const [objectives, setObjectives] = useState<Objective[]>(mockObjectives);

  const updateObjective = (updated: Objective) => {
    setObjectives((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  return (
    <ObjectivesContext.Provider value={{ objectives, updateObjective }}>
      {children}
    </ObjectivesContext.Provider>
  );
}

export function useObjectives() {
  const context = useContext(ObjectivesContext);
  if (!context) throw new Error('useObjectives must be used within ObjectivesProvider');
  return context;
}
