'use client';
import { createContext, useContext, useState, Dispatch, SetStateAction, ReactNode } from 'react';

interface Metadata {
    name?: string;
    symbol?: string;
    image?: string;
    createdOn?: string;
    description?: string;
    showName?: boolean;
    telegram?: string;
    twitter?: string;
    website?: string;
}

interface MetadataContextType {
    metadata: Metadata | null;
    setMetadata: Dispatch<SetStateAction<Metadata | null>>;
}


const MetadataContext = createContext<MetadataContextType | undefined>(undefined);

export const MetadataProvider = ({ children }: { children: ReactNode }) => {
    const [metadata, setMetadata] = useState<Metadata | null>(null);

    return (
        <MetadataContext.Provider value={{ metadata, setMetadata }}>
            {children}
        </MetadataContext.Provider>
    );
};

export const useMetadata = () => {
    const context = useContext(MetadataContext);
    if (!context) {
        throw new Error('useMetadata must be used within a MetadataProvider');
    }
    return context;
};

