'use client';
import React, { useEffect, useState } from "react";
import Header from '@/components/Header';
import AboutToGraduateSection from '@/components/AbtGrd';
import NewlyCreatedSection from '@/components/NewlyCreated';
interface Impression {
  name: string;
  value: number;
}
export default function Home() {
  const [addresses, setAddresses] = useState<{ address: string; }[]>([]);
  const [metadata, setMetadata] = useState<{ name: string; symbol: string; uri: string }[]>([]);
  const [othermetadata, setOtherMetadata] = useState<{ name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }[]>([]);
  const [impressionsData, setImpressionsData] = useState<Impression[][]>([]);
  const [usernames, setUsernames] = useState<string[][]>([]);
  const [tweets, setTweets] = useState<string[][]>([]);

  const parseViewsCount = (views: string): number => {
    if (views.endsWith('K')) {
      return parseFloat(views) * 1000; // Convert "2K" to 2000
    } else if (views.endsWith('M')) {
      return parseFloat(views) * 1000000; // Convert "1M" to 1000000
    }
    return parseFloat(views); // For plain numbers
  };
  useEffect(() => {
    // Fetch the JSON file
    fetch(`http://${window.location.hostname}:3300/addresses/address.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => { setAddresses(data) })
      .catch((error) => console.error("Failed to fetch addresses:", error));
  }, []);

  useEffect(() => {

    const fetchMetadata = async () => {
      const fetchedMetadata: { name: string; symbol: string; uri: string }[] = [];
      for (const address of addresses) {
        // console.log("addresses", addresses, "address", address.address)
        try {
          const response = await fetch(`http://${window.location.hostname}:3300/api/token-metadata?mint=${address.address}`);
          const data = await response.json();
          fetchedMetadata.push(data);

        } catch (error) {
          console.error('Error fetching token metadata:', error);
        }
      };
      setMetadata((prevMetadata) => [...prevMetadata, ...fetchedMetadata]);
    }
    fetchMetadata();

  }, [addresses]);

  useEffect(() => {
    const fetchMetadata = async () => {
      const fetchedOtherMetadata: { name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }[] = [];
      for (const metadata_ of metadata) {
        if (!metadata_?.uri) {
          console.error('Metadata URI is missing');
          return;
        }
        try {
          const response = await fetch(metadata_.uri);
          const data = await response.json();
          //setOtherMetadata(data)
          fetchedOtherMetadata.push(data);
        } catch (error) {
          console.error('Error fetching token metadata:', error);
        }
      }
      setOtherMetadata((prevMetadata) => [...prevMetadata, ...fetchedOtherMetadata]);
    };

    fetchMetadata();
  }, [metadata]);
  useEffect(() => {
    const fetchData = async () => {
      const extractedNestedUsernames: string[][] = [];
      const extractedNestedTweets: string[][] = [];
      const impressionNestedArry: Impression[][] = []
     
      for (const address of addresses) {
        //console.log("Address cc",address.address)
        const response = await fetch(`http://${window.location.hostname}:3300/fetch-data?search=${address.address}`); // Load the JSON data
        const jsonData = await response.json();

        // Process data to calculate total views for each unique time
        const viewCounts: { [key: string]: number } = {};
        const extractedUsernames: string[] = [];
        const extractedTweets: string[] = [];
        jsonData.forEach((entry: any) => {
          const times = entry.params.time;
          const views = entry.params.views;
          const statusUrl = entry.status;
          const username = statusUrl.split('https://x.com/')[1].split('/status/')[0];

          extractedUsernames.push("@" + username);
          const tweets = entry.tweet;
          extractedTweets.push(tweets)
          times.forEach((time: number, index: number) => {
            const view = isNaN(parseViewsCount(views[index])) ? 0 : parseViewsCount(views[index]);
            const timeKey = `${time} min`;

            if (viewCounts[timeKey]) {
              viewCounts[timeKey] += view;
            } else {
              viewCounts[timeKey] = view;
            }
          });
        });
        extractedNestedUsernames.push(extractedUsernames)
        extractedNestedTweets.push(extractedTweets)
        // Convert the viewCounts object into an array
        const impressionsArray = Object.entries(viewCounts).map(([name, value]) => ({
          name,
          value
        }));
        impressionNestedArry.push(impressionsArray)
      }
      console.log("Impression Data",impressionNestedArry)
      setImpressionsData(impressionNestedArry);
      setUsernames(extractedNestedUsernames);
      setTweets(extractedNestedTweets)

    };

    fetchData();
  }, [addresses]);
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-grow p-4">
        {/* About to Graduate Section */}
        <AboutToGraduateSection addresses={addresses} othermetadata={othermetadata} usrname={usernames} tweets={tweets} impressionsData={impressionsData} />

        {/* Newly Created Section */}

        <NewlyCreatedSection addresses={addresses} othermetadata={othermetadata} usrname={usernames} tweets={tweets} impressionsData={impressionsData} />
      </main>
    </div>
  );
}
