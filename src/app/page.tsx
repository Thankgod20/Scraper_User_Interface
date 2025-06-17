'use client';
import React, { useEffect, useState } from "react";
import Header from '@/components/Header';
import AboutToGraduateSection from '@/components/AbtGrd';
import { useNotificationPermission } from "../../hooks/useNotification";
import UITable from '@/components/UITable'; // Import the new UITable component

interface Impression {
  name: string;
  value: number;
}
interface CompImpression {
  name: string;
  value: number;
  preval: number;
}
export default function Home() {
  useNotificationPermission();
  const [addresses, setAddresses] = useState<{ address: string; }[]>([]);
  const [metadata, setMetadata] = useState<{ name: string; symbol: string; uri: string }[]>([]);
  const [othermetadata, setOtherMetadata] = useState<{ name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }[]>([]);
  const [impressionsData, setImpressionsData] = useState<CompImpression[][]>([]);
  const [usernames, setUsernames] = useState<string[][]>([]);
  const [tweets, setTweets] = useState<string[][]>([]);
  //const [viewCounts, setViewCounts] = useState<string[][]>([]); // Adding viewCounts state
  const [tweetPerMinute, setTweetsPerMinuteData] = useState<Impression[][]>([]);
  const parseViewsCount = (views: string): number => {
    if (views.endsWith('K')) {
      return parseFloat(views) * 1000; // Convert "2K" to 2000
    } else if (views.endsWith('M')) {
      return parseFloat(views) * 1000000; // Convert "1M" to 1000000
    }
    return parseFloat(views); // For plain numbers
  };

  const fetchHostnameFromConfig = async () => {
    try {
      const configResponse = await fetch('/config.json');
      if (!configResponse.ok) {
        throw new Error('Failed to load config file');
      }
      const configData = await configResponse.json();
      console.log("Configuration", configData);
      return configData.hostname; // Return the hostname from the config
    } catch (error) {
      console.error('Error fetching hostname from config:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Fetch the JSON file
    const fetchMetadatax = async () => {
      const hostname = await fetchHostnameFromConfig();
      fetch(`http://${hostname}:3300/addresses/address.json`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => { setAddresses(data) })
        .catch((error) => console.error("Failed to fetch addresses:", error));
    }
    fetchMetadatax()
  }, []);

  useEffect(() => {
    const fetchMetadata = async () => {
      const fetchedMetadata: { name: string; symbol: string; uri: string }[] = [];
      for (const address of addresses) {
        // console.log("addresses", addresses, "address", address.address)
        try {
          const hostname = await fetchHostnameFromConfig();
          const response = await fetch(`http://${hostname}:3300/api/token-metadata?mint=${address.address}`);
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
      const extractedNestedViewCounts: string[][] = []; // For storing view counts
      const impressionNestedArry: CompImpression[][] = []
      const tweetnNestedArry: Impression[][] = []
      
      let index = 0
      for (const address of addresses) {
        const tweetViews: { [key: string]: { last: number; prev: number } } = {};//const 
        const tweetCounts: { [key: string]: number } = {};
        //console.log("Address cc",address.address)
        const hostname = await fetchHostnameFromConfig();
        const response = await fetch(`http://${hostname}:3300/fetch-data?search=${address.address}`); // Load the JSON data
        const jsonData = await response.json();
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          console.warn('No data returned for', address.address);
          extractedNestedUsernames.push([]);
          extractedNestedTweets.push([]);
          extractedNestedViewCounts.push([]);
          impressionNestedArry.push([]);
          tweetnNestedArry.push([]);
          index += 1;
          continue;  // go on to the next address
        }
        // Process data to calculate total views for each unique time
       // const viewCounts: { [key: string]: number } = {};
        const extractedUsernames: string[] = [];
        const extractedTweets: string[] = [];
        const extractedViews: string[] = []; // Array for storing view counts
        const validEntries = jsonData.filter((entry: { tweet: string; params: { time: string[]; views: string[] }; post_time: string; status: string }) => {
          
          return entry.tweet && (entry.tweet.includes(address.address) || entry.tweet.includes(metadata[index]?.symbol));
        });
        validEntries.forEach((entry: { tweet: string; params: { time: string[]; views: string[] }; post_time: string; status: string }) => {
          //const times = entry.params.time;
          const views = entry.params.views;
          const timestamp = entry.post_time
          const statusUrl = entry.status;
          const username = statusUrl.split('https://x.com/')[1].split('/status/')[0];

          extractedUsernames.push("@" + username);
          const tweets = entry.tweet;
          extractedTweets.push(tweets);
          extractedViews.push(views.join(',')); // Store the views array as a comma-separated string
          
          let minuteKey;
          if (timestamp) {
              try {
                  minuteKey = new Date(timestamp).toISOString().slice(0, 16);
              } catch (error) {
                  console.warn("Invalid timestamp:", timestamp, error);
                  minuteKey = new Date().toISOString().slice(0, 16);
              }
          } else {
              console.warn("Timestamp is empty or null, using current time.");
              minuteKey = new Date().toISOString().slice(0, 16);
          }
     
          const view = isNaN(parseViewsCount(views[views.length-1])) ? 0 : parseViewsCount(views[views.length-1]);
          let viewPrev = 0
          if (views.length>1) {
            viewPrev = isNaN(parseViewsCount(views[views.length-2])) ? 0 : parseViewsCount(views[views.length-2]);
          }
          if (tweetViews[minuteKey]) {
            tweetViews[minuteKey].last += view;
            tweetViews[minuteKey].prev += viewPrev;
          } else {
            tweetViews[minuteKey] = { last: view, prev: viewPrev };
          }


          if (tweetCounts[minuteKey]) {
            tweetCounts[minuteKey] += 1; // Increment the count for tweets in this minute
          } else {
            tweetCounts[minuteKey] = 1; // Initialize with 1 tweet for this minute
          }
          
          
        });
        
        extractedNestedUsernames.push(extractedUsernames);
        extractedNestedTweets.push(extractedTweets);
        extractedNestedViewCounts.push(extractedViews); // Store views for this address
        
        // Convert the viewCounts object into an array
       /* const impressionsArray = Object.entries(viewCounts).map(([name, value]) => ({
          name,
          value
        }));*/
        const tweetsPerViewsMinuteArray = Object.entries(tweetViews)
        .map(([name, data]) => ({
        name,
        value: data.last,
        preval: data.prev
        }))
        .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        impressionNestedArry.push(tweetsPerViewsMinuteArray);
        const tweetsPerMinuteArray = Object.entries(tweetCounts).map(([name, value]) => ({
          name,
          value
        })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        tweetnNestedArry.push(tweetsPerMinuteArray) 

        index+=1
      }
      
      //console.log("Impression Data", impressionNestedArry);
      setImpressionsData(impressionNestedArry);
      setUsernames(extractedNestedUsernames);
      setTweetsPerMinuteData(tweetnNestedArry);
      setTweets(extractedNestedTweets);
      //setViewCounts(extractedNestedViewCounts); // Set the view counts state
    };

    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 60000); // Fetch every 60 seconds

    return () => clearInterval(interval);
  }, [addresses,metadata]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-grow p-4">
        {/* UI Table - Add this section */}
        

        {/* About to Graduate Section */}
        <AboutToGraduateSection 
          addresses={addresses} 
          othermetadata={othermetadata} 
          usrname={usernames} 
          tweets={tweets} 
          impressionsData={impressionsData} 
        />

        {/* Newly Created Section */}
        <UITable 
          addresses={addresses} 
          othermetadata={othermetadata} 
          usrname={usernames} 
          tweetsPerMin ={tweetPerMinute}
          tweets={tweets} 
          impressionsData={impressionsData} 
        />
  
      </main>
    </div>
  );
}
