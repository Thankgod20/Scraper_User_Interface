import React from "react";
import Card from "./Card";

interface Impression {
  name: string;
  value: number;
}

interface AboutToGraduateSectionProps {
  addresses: any[];
  othermetadata: { image: string; name: string; symbol: string }[];
  usrname: string[][];
  tweets: any[][];
  impressionsData: Impression[][];
}

const AboutToGraduateSection: React.FC<AboutToGraduateSectionProps> = ({
  addresses,
  othermetadata,
  usrname,
  tweets,
  impressionsData,
}) => {
  // 1. Build a unified data array
  const cardsData = addresses.map((address, idx) => ({
    address,
    metadata: othermetadata[idx] || {},
    usernames: usrname[idx] || [],
    tweets: tweets[idx] || [],
    impressions: impressionsData[idx] || [],
    tweetCount: (tweets[idx] || []).length,
  }));

  // 2. Sort descending by tweetCount
  cardsData.sort((a, b) => b.tweetCount - a.tweetCount);

  return (
    <section className="mb-6">
      <h2 className="text-sm text-gray-400 mb-2">Trending Token</h2>
      <div className="flex overflow-x-auto space-x-4">
        {cardsData.map((card, index) => (
          <Card
            key={card.address + index}
            imageSrc={card.metadata.image}
            tkName={card.metadata.name}
            tkSymbl={card.metadata.symbol}
            address={card.address.address}
            tweets={card.tweets}
          />
        ))}
      </div>
    </section>
  );
};

export default AboutToGraduateSection;
