import React, { useEffect, useState } from "react";
import Card from "./Card";
interface Impression {
    name: string;
    value: number;
}
interface AboutToGraduateSectionProps {
    addresses: any[];
    othermetadata: any[]
    usrname: any[][]
    tweets: any[][]
    impressionsData: Impression[][]
}
const AboutToGraduateSection: React.FC<AboutToGraduateSectionProps> = ({ addresses, othermetadata, usrname, tweets, impressionsData }) => {
    const cards = [
        { title: "MC $67.7k", subtitle: "9.6k" },
        { title: "MC $65.1k", subtitle: "15.2k" },
        { title: "MC $59.5k", subtitle: "11k" },
        { title: "MC $57.8k", subtitle: "13.7k" },
        { title: "MC $53.3k", subtitle: "5.1k" },
    ];

    return (
        <section className="mb-6">
            <h2 className="text-sm text-gray-400 mb-2">Trending Token</h2>
            <div className="flex overflow-x-auto space-x-4">
                {addresses.map((addressObj, index) => (
                    <Card key={index} imageSrc={othermetadata[index]?.image} tkName={othermetadata[index]?.name} tkSymbl={othermetadata[index]?.symbol} usernames={usrname[index]} tweets={tweets[index]} />
                ))}
            </div>
        </section>
    );
};

export default AboutToGraduateSection;
