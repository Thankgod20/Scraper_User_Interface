import React, { JSX, useState, useEffect } from 'react';
import LineGraph from "./LineGraph";
import DLineGraph from './DetailedLineGraph';
import { NumberFormatter } from '@/app/utils/largeNumber';
import { QRCodeCanvas } from "qrcode.react"; // Ensure you install this package: npm install qrcode.react
import Modal from "react-modal";
import ReactDOM from "react-dom";
//Modal.setAppElement("#root");

interface MetricCardProps {
    title: string;
    value: string;
    percentageChange: string;
    subText: string;
    graph: JSX.Element;
    isPositiveChange: boolean;
    onClick: () => void;
}
interface Impression {
    name: string;
    value: number;
}
interface MetricGridProps {
    address: any;
    name: any;
    twitter: any;
    tweetPerMinut: Impression[];
    impression: Impression[];
    engagement: Impression[];
}
const impressionsData = [
    { name: "Jan 1", value: 70 },
    { name: "Jan 2", value: 75 },
    { name: "Jan 3", value: 80 },
    { name: "Jan 4", value: 185 },
    { name: "Jan 5", value: 90 },
    { name: "Jan 6", value: 83 },
    { name: "Jan 7", value: 183.45 },
];
const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    percentageChange,
    subText,
    graph,
    isPositiveChange,
    onClick
}) => {
    return (
        <div className="bg-gray-900 text-white p-4 rounded-lg shadow-md" onClick={onClick}>
            {/* Title */}
            <h3 className="text-sm text-gray-400 mb-1">{title}</h3>

            {/* Main Value */}
            <div className="text-2xl font-bold mb-2">{value}</div>

            {/* Percentage Change */}
            <div
                className={`text-sm ${isPositiveChange ? "text-green-400" : "text-red-400"}`}
            >
                {percentageChange}
            </div>

            {/* Subtext */}
            <p className="text-xs text-gray-500 mt-1">{subText}</p>

            {/* Graph */}
            <div className="mt-4">{graph}</div>
        </div>
    );
};
function calculateSentimentMomentum(impressions: Impression[]): number {
    if (impressions.length < 2) return 0;

    const changes = [];
    for (let i = 0; i < impressions.length - 1; i++) {
        const change = impressions[i + 1].value - impressions[i].value;
        changes.push(change);
    }
    const totalChange = changes.reduce((sum, change) => sum + change, 0);
    return totalChange / changes.length; // Average change over time
}

function calculateSentimentVolatility(impressions: Impression[]): number {
    if (impressions.length < 2) return 0;

    const average = impressions.reduce((sum, imp) => sum + imp.value, 0) / impressions.length;
    const squaredDiffs = impressions.map(imp => Math.pow(imp.value - average, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
    return Math.sqrt(variance); // Standard deviation as volatility
}

function calculateSentimentWeightedMetrics(impressions: Impression[], engagements: Impression[]): number {
    if (impressions.length !== engagements.length || impressions.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < impressions.length; i++) {
        weightedSum += impressions[i].value * engagements[i].value; // Impression * Engagement
        totalWeight += engagements[i].value;
    }

    return totalWeight !== 0 ? weightedSum / totalWeight : 0;
}

function detectSentimentPeaks(impressions: Impression[]): Impression[] {
    if (impressions.length < 3) return [];

    const peaks = [];
    for (let i = 1; i < impressions.length - 1; i++) {
        if (impressions[i].value > impressions[i - 1].value && impressions[i].value > impressions[i + 1].value) {
            peaks.push(impressions[i]); // Local maxima
        }
    }

    return peaks;
}
function calculateSentimentScore(tweetGrowth: number, impressions: number): number {
    // Normalize tweetGrowth and impressions to a scale from 0 to 100
    const maxGrowth = 100; // Set max tweet growth to 100%
    const maxImpressions = 100; // Set max impressions to 100%

    // Normalize tweetGrowth and impressions values
    const normalizedTweetGrowth = Math.min(tweetGrowth, maxGrowth);
    const normalizedImpressions = Math.min(impressions, maxImpressions);

    // Define weight for each metric
    const weightGrowth = 0.6; // Weight for tweet growth
    const weightImpression = 0.4; // Weight for impressions

    // Calculate the sentiment score using weighted averages
    const sentimentScore = weightGrowth * normalizedTweetGrowth + weightImpression * normalizedImpressions;

    // Ensure the sentiment score does not exceed 100
    return Math.min(sentimentScore, 100);
}
function calculateAveragePercentage(impressions: Impression[]): number {
    if (impressions.length < 2) return 0; // If less than 2 impressions, no percentage difference to calculate

    const percentageDifferences: number[] = [];

    for (let i = 0; i < impressions.length - 1; i++) {
        const currentValue = impressions[i].value;
        const nextValue = impressions[i + 1].value;

        // Calculate percentage difference between currentValue and nextValue
        const percentageDiff = ((nextValue - currentValue) / currentValue) * 100;
        percentageDifferences.push(percentageDiff);
    }

    // Calculate average percentage difference
    const total = percentageDifferences.reduce((sum, diff) => sum + diff, 0);
    return total / percentageDifferences.length;
}
function calculateCumulativePercentage(impressions: Impression[]): Impression[] {
    if (impressions.length < 2) {
        return impressions; // Return as is if there aren't enough items to compare
    }

    // Initialize variables
    const result: Impression[] = [];
    let cumulativeSum = 0;

    for (let i = 0; i < impressions.length; i++) {
        if (i === 0) {
            // For the first element, cumulative sum is 0 as there's no previous value
            result.push({ name: impressions[i].name, value: 0 });
        } else {
            // Calculate percentage difference from the previous value
            const prevValue = impressions[i - 1].value;
            const currValue = impressions[i].value;

            // Avoid division by zero
            if (prevValue !== 0) {
                const percentageDiff = ((currValue - prevValue) / prevValue);
                cumulativeSum += percentageDiff;
            }

            // Push the new object with cumulative sum
            result.push({ name: impressions[i].name, value: cumulativeSum });
        }
    }

    return result;
}


function categorizeTweetsByInterval(data: Impression[], minute: number): Impression[] {
    // Helper function to round a date down to the nearest specified minute
    function roundToNearestMinutes(date: Date): Date {
        const msInMinutes = minute * 60 * 1000;
        return new Date(Math.floor(date.getTime() / msInMinutes) * msInMinutes);
    }

    // Map to store aggregated data
    const intervalMap: Record<string, number> = {};

    data.forEach(({ name, value }) => {
        const date = new Date(name);
        const roundedDate = roundToNearestMinutes(date);

        // Format the date without converting to UTC
        const year = roundedDate.getFullYear();
        const month = String(roundedDate.getMonth() + 1).padStart(2, '0');
        const day = String(roundedDate.getDate()).padStart(2, '0');
        const hours = String(roundedDate.getHours()).padStart(2, '0');
        const minutes = String(roundedDate.getMinutes()).padStart(2, '0');
        const seconds = String(roundedDate.getSeconds()).padStart(2, '0');
        const milliseconds = String(roundedDate.getMilliseconds()).padStart(3, '0');

        const intervalKey = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;

        if (!intervalMap[intervalKey]) {
            intervalMap[intervalKey] = 0;
        }

        intervalMap[intervalKey] += value;
    });

    // Convert the map to an array of AggregatedData
    const aggregatedData: Impression[] = Object.entries(intervalMap).map(
        ([name, value]) => ({ name, value })
    );

    // Sort by interval
    aggregatedData.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

    return aggregatedData;
}


const MetricsGrid: React.FC<MetricGridProps> = ({ address, name, twitter, tweetPerMinut, impression, engagement }) => {
    //console.log("twitter,twitter", twitter, name)
    let twt = `https://x.com/search?q=${address}`
    if (twitter != null) {
        twt = twitter
    }
    const [selectedMetric, setSelectedMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);

    const totalTweets_ = tweetPerMinut.reduce((sum, impression) => sum + impression.value, 0);

    const [sentiment, setSentiment] = useState(0);
    const [tweetGrowth, setTweetGrowth] = useState("");
    const totalTweets = NumberFormatter.formatNumber(totalTweets_)

    const tweetPerFVmints = categorizeTweetsByInterval(tweetPerMinut, 5)
    const averagePercentageFv = calculateAveragePercentage(tweetPerFVmints);
    const cummulatedSumFv = calculateCumulativePercentage(tweetPerFVmints)

    const averagePercentage = calculateAveragePercentage(tweetPerMinut);
    const cummulatedSum = calculateCumulativePercentage(tweetPerMinut)
    const cumuImpression = calculateCumulativePercentage(impression)
    const cumuAvrage = calculateAveragePercentage(impression)
    const cumuEngage = calculateCumulativePercentage(engagement)
    const cumuAvragEngage = calculateAveragePercentage(engagement)
    const sentimentMomentum = calculateSentimentMomentum(impression);
    const sentimentVolatility = calculateSentimentVolatility(impression);
    const weightedSentiment = calculateSentimentWeightedMetrics(impression, engagement);
    const sentimentPeaks = detectSentimentPeaks(impression);


    const openPopup = (title: string, data: Impression[]) => {
        setSelectedMetric({ title, data });
    };

    // Close Modal
    const closePopup = () => {
        setSelectedMetric(null);
    };
    useEffect(() => {
        Modal.setAppElement("#root");
        //console.log("cummulatedSum", cummulatedSum)
        if (cummulatedSum.length == 0) {
            return
        }
        const sentimentScore = calculateSentimentScore(Number(cummulatedSum[cummulatedSum.length - 1].value), Number(cumuImpression[cumuImpression.length - 1].value));
        const tweetGrowth_ = NumberFormatter.formatNumber(
            Number(((cummulatedSum[cummulatedSum.length - 1].value / cummulatedSum.length) * 100).toFixed(2))
        )
        //console.log("Sentiment Score", sentimentScore)
        setTweetGrowth(tweetGrowth_)
        setSentiment(sentimentScore)
    }, [cummulatedSum]);
    return (
        <div className="bg-gray-800 text-white rounded-lg p-4 shadow-lg max-w-md ">
            <div id="root"></div>
            {/* Top Section with Image and QR Code */}
            <div className="flex items-center justify-between mb-4">

                {/* Image */}
                <div className="flex-grow border-100 border-black rounded-[5px] p-2">
                    <img
                        src={name} // Replace with your actual image URL
                        alt="Top Display"
                        className="rounded-[5px] w-full h-full object-cover"
                        style={{ width: "150px" }}
                    />
                </div>
                <div className="flex-grow"></div>
                {/* QR Code */}
                <div className="flex-shrink-0 mr-4 border-10 border-black rounded-[5px] p-2">
                    <QRCodeCanvas value={address} size={150} className="rounded-[5px]" />
                </div>



            </div>

            {/* Wallet Address */}
            <p className="text-xs text-gray-400 mb-6 text-center">
                Address: <span className="text-white font-mono bg-gray-500 p-1 rounded-[5px]">{address}</span>
            </p>

            {/* Buttons */}
            <div className="flex space-x-2 mb-4">
                <a
                    href={twt} // Replace with the desired Twitter search URL
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-1/2 bg-green-500 text-white py-2 rounded-lg font-bold text-center"
                >
                    X/Twitter
                </a>
                <a
                    href={`https://dexscreener.com/search?q=${address}`} // Replace with the desired DexScreener URL
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-1/2 bg-gray-700 text-gray-300 py-2 rounded-lg font-bold text-center"
                >
                    DexScreener
                </a>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 gap-4 h-[50vh] overflow-y-auto">
                <MetricCard
                    title="Tweet Growth #2"
                    value={(cummulatedSum.length > 0 ? tweetGrowth : 0) + "%"}
                    percentageChange={(Number(tweetGrowth) > 0 ? "+" : "") + tweetGrowth + "% TM"}
                    subText={(cummulatedSum.length > 0 ? tweetGrowth : 0) + "% Tweet Growths Indicate a" + (Number(tweetGrowth) > 0 ? " Positive" : " Negetive") + " Sentiments"}
                    isPositiveChange={Number(tweetGrowth) > 0}
                    graph={<LineGraph data={cummulatedSum} color="#10B981" />}
                    onClick={() => openPopup("Tweet Growth Avg", cummulatedSum)}
                />
                <MetricCard
                    title="Callers/min (Avg.)"
                    value={totalTweets}
                    percentageChange={(averagePercentage > 0 ? "+" : "") + averagePercentage.toFixed(2) + "% TM"}
                    subText={averagePercentage.toFixed(2) + (averagePercentage > 0 ? " Increase" : " Descrease") + " In tweets/Mins" + (averagePercentage > 0 ? " Bullish" : " Bearish") + " sentiment"}
                    isPositiveChange={averagePercentage > 0}
                    graph={<LineGraph data={tweetPerMinut} color="#10B981" />}
                    onClick={() => openPopup("Callers/min (Avg.)", tweetPerMinut)}
                />
                <MetricCard
                    title="Callers/5min (Avg.)"
                    value={totalTweets}
                    percentageChange={(averagePercentageFv > 0 ? "+" : "") + averagePercentageFv.toFixed(2) + "% TM"}
                    subText={averagePercentageFv.toFixed(2) + (averagePercentageFv > 0 ? " Increase" : " Descrease") + " In tweets/Mins" + (averagePercentageFv > 0 ? " Bullish" : " Bearish") + " sentiment"}
                    isPositiveChange={averagePercentageFv > 0}
                    graph={<LineGraph data={tweetPerFVmints} color="#10B981" />}
                    onClick={() => openPopup("Callers/min (Avg.)", tweetPerFVmints)}
                />{/*
                <MetricCard
                    title="Engagement (Avg.)"
                    value={(cumuEngage.length > 0 ? NumberFormatter.formatNumber(Number(cumuEngage[cumuEngage.length - 1].value.toFixed(2))) : 0) + "%"}
                    percentageChange={(cumuAvragEngage > 0 ? "+" : "") + cumuAvragEngage.toFixed(2) + "% Engage"}
                    subText="engagements meter"
                    isPositiveChange={cumuAvragEngage > 0}
                    graph={<LineGraph data={cumuEngage} color="#10B981" />}
                    onClick={() => openPopup("Engagement (Avg.)", cumuEngage)}
                />*/}
                <MetricCard
                    title="Impressions (Avg.%)"
                    value={(cumuImpression.length > 0 ? NumberFormatter.formatNumber(Number(cumuImpression[cumuImpression.length - 1].value.toFixed(2))) : 0) + "%"}
                    percentageChange={(cumuAvrage > 0 ? "+" : "") + cumuAvrage.toFixed(2) + "% Impression"}
                    subText={cumuAvrage.toFixed(2) + (cumuAvrage > 0 ? " Increase" : " Descrease") + " In Impression suggest a " + (cumuAvrage > 0 ? " Bullish" : " Bearish") + " sentiment"}
                    isPositiveChange={cumuAvrage > 0}
                    graph={<LineGraph data={cumuImpression} color="#10B981" />}
                    onClick={() => openPopup("Impressions Avg", cumuImpression)}
                />

                <MetricCard
                    title="Sentiment Momentum"
                    value={sentimentMomentum.toFixed(2)}
                    percentageChange="Momentum Rate"
                    subText="Average sentiment change over time"
                    isPositiveChange={sentimentMomentum > 0}
                    graph={<LineGraph data={impression} color="#3B82F6" />}
                    onClick={() => openPopup("Sentiment Momentum", impression)}
                />
                <MetricCard
                    title="Sentiment Volatility"
                    value={sentimentVolatility.toFixed(2)}
                    percentageChange="Variability"
                    subText="Variability in sentiment over time"
                    isPositiveChange={sentimentVolatility < 10}
                    graph={<LineGraph data={impression} color="#F59E0B" />}
                    onClick={() => openPopup("Sentiment Volatility", impression)}
                />
                <MetricCard
                    title="Weighted Sentiment"
                    value={weightedSentiment.toFixed(2)}
                    percentageChange="Weighted Value"
                    subText="Sentiment adjusted for engagement"
                    isPositiveChange={weightedSentiment > 0}
                    graph={<LineGraph data={impression} color="#10B981" />}
                    onClick={() => openPopup("Weighted Sentiment", engagement)}
                />
                <MetricCard
                    title="Peak Sentiments"
                    value={sentimentPeaks.length.toString()}
                    percentageChange="Detected Peaks"
                    subText="Number of sentiment peaks detected"
                    isPositiveChange={sentimentPeaks.length > 0}
                    graph={<LineGraph data={sentimentPeaks} color="#EF4444" />}
                    onClick={() => openPopup("Peak Sentiments", sentimentPeaks)}
                />
            </div>
            <div style={{ textAlign: "center", padding: "20px" }}>
                <h1>Sentiment Meter</h1>

                <SentimentMeter value={Math.round(sentiment)} />
            </div>
            {/* Popup Modal */}
            <Modal
                isOpen={!!selectedMetric}
                onRequestClose={closePopup}
                contentLabel="Metric Details"
                className="bg-gray-900 text-white w-[90vw] max-w-[1400px] h-[85vh] max-w-2xl mx-auto rounded-lg p-6 shadow-lg"
                overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
            >
                {selectedMetric && (
                    <>
                        <h3 className="text-xl font-bold mb-4">{selectedMetric.title}</h3>
                        <DLineGraph data={selectedMetric.data || []} color="#3B82F6" detailed />
                        <button
                            className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
                            onClick={closePopup}
                        >
                            Close
                        </button>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default MetricsGrid;


interface SentimentMeterProps {
    value: number; // Value between 0 and 100
}

const SentimentMeter: React.FC<SentimentMeterProps> = ({ value }) => {
    const boundedValue = Math.min(100, Math.max(0, value)); // Clamp value between 0 and 100
    const rotation = (boundedValue / 100) * 180 - 90; // Convert value to degrees

    // Determine sentiment label and color
    const sentimentLabel =
        boundedValue < 25
            ? "Fear"
            : boundedValue < 50
                ? "Caution"
                : boundedValue < 75
                    ? "Neutral"
                    : "Confidence";

    const labelColor =
        boundedValue < 25
            ? "red"
            : boundedValue < 50
                ? "orange"
                : boundedValue < 75
                    ? "yellowgreen"
                    : "green";

    const meterStyle: React.CSSProperties = {
        position: "relative",
        width: "250px",
        height: "125px",
        backgroundColor: "#2E2E2E", // Dark background
        borderRadius: "250px 250px 0 0", // Semi-circle
        overflow: "hidden",
    };

    const segmentContainerStyle: React.CSSProperties = {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 20px",
    };

    const segmentStyle = (color: string): React.CSSProperties => ({
        flex: 1,
        height: "20px",
        margin: "0 5px",
        backgroundColor: color,
        borderRadius: "10px",
    });

    const dialStyle: React.CSSProperties = {
        position: "absolute",
        bottom: "0",
        left: "50%",
        width: "2px",
        height: "100px",
        backgroundColor: "white",
        transformOrigin: "bottom",
        transform: `rotate(${rotation}deg)`,
    };

    const pointerCircleStyle: React.CSSProperties = {
        position: "absolute",
        bottom: "-10px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "20px",
        height: "20px",
        backgroundColor: "red",
        borderRadius: "50%",
    };

    const labelStyle: React.CSSProperties = {
        textAlign: "center",
        marginTop: "20px",
        color: "white",
        fontSize: "20px",
        fontWeight: "bold",
    };

    const valueStyle: React.CSSProperties = {
        fontSize: "40px",
        color: "white",
    };

    const sentimentStyle: React.CSSProperties = {
        color: labelColor,
    };

    return (
        <div style={{ textAlign: "center" }}>
            {/* Semi-circle meter */}
            <div style={meterStyle}>
                {/* Segments */}
                <div style={segmentContainerStyle}>
                    <div style={segmentStyle("red")} />
                    <div style={segmentStyle("orange")} />
                    <div style={segmentStyle("yellowgreen")} />
                    <div style={segmentStyle("green")} />
                </div>

                {/* Dial */}
                <div style={dialStyle}>
                    <div style={pointerCircleStyle} />
                </div>
            </div>

            {/* Value and sentiment */}
            <div style={labelStyle}>
                <div style={valueStyle}>{boundedValue}</div>
                <div style={sentimentStyle}>{sentimentLabel}</div>
            </div>
        </div>
    );
};
