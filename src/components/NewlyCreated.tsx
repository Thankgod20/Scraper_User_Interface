'use client';
import React, { useEffect, useState } from "react";
import TableRow from "./TableRow";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMetadata } from "@/context/MetadataContext";
interface Impression {
    name: string;
    value: number;
}
interface NewlyCreatedSectionProps {
    addresses: any[];
    othermetadata: any[]
    usrname: any[][]
    tweets: any[][]
    impressionsData: Impression[][]
}

const NewlyCreatedSection: React.FC<NewlyCreatedSectionProps> = ({ addresses, othermetadata, usrname, tweets, impressionsData }) => {
    const router = useRouter();
    const { setMetadata } = useMetadata();

    const handleRowClick = (address: string, metadata: any) => {
        setMetadata(metadata);
        router.push(`/coin/${address}`);
    };
    return (
        <section>
            <h2 className="text-sm text-gray-400 mb-2">newly created</h2>
            <div className="overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-800">
                        <tr>
                            <th className="px-4 py-2 ">Coin</th>
                            <th className="px-4 py-2">Impressions</th>
                            <th className="px-4 py-2 text-center">Callers</th>
                            <th className="px-4 py-2">Tweets</th>
                        </tr>
                    </thead>
                    <tbody>
                        {addresses.map((addressObj, index) => (
                            <tr
                                key={index}
                                onClick={() => handleRowClick(addressObj.address, othermetadata[index])}
                                style={{ cursor: 'pointer' }}
                                className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700 transition-colors"
                            >
                                <TableRow key={index} imageSrc={othermetadata[index]?.image} tkName={othermetadata[index]?.name} tkSymbl={othermetadata[index]?.symbol} usernames={usrname[index]} tweets={tweets[index]} impressionsData={impressionsData[index]} />
                            </tr>

                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default NewlyCreatedSection;
