"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
} from "recharts";
import React, { useState, useRef } from "react";

export type BuyActivity = {
  time: string;
  uniqueBuyers: number;
  netGrowth: number;
  diversityScore: number;
  buyScore: number;
  retailChurnRatio: number;
  whaleChurnRatio: number;
};

type ZoomReport = {
  totalpage: number;
  currentpage: number;
};

type Props = {
  data: BuyActivity[];
  showDetails?: boolean;
  title?: string;
  darkMode?: boolean;
  funtype: string;
  onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
};

export default function BuyActivityChart({
  data,
  showDetails = true,
  title = "Buy Activity Score (BAS) Over Time",
  darkMode = false,
  funtype,
  onZoomOrPan,
}: Props) {
  const textColor = darkMode ? "#ddd" : "#333";
  const gridColor = darkMode ? "#555" : "#ccc";
  const [isLoaded, setIsLoaded] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const pageRef = useRef(1);
  const totalPage = useRef(0);
  const throttleRef = useRef(false);

  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    buyScore: true,
    retailChurnRatio: true,
    whaleChurnRatio: true,
    uniqueBuyers: true,
  });

  const toggleLine = (key: string) => {
    setVisibleLines((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const formattedData = data.map((d) => ({
    ...d,
    formattedTime: new Date(d.time).toISOString(),
  }));
  data.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <div className={`w-full h-[480px] p-4 rounded-lg ${darkMode ? "" : "bg-white"}`}>
      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-800"}`}>
        {title}
      </h3>

      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {Object.entries({
          buyScore: "Buy Score",
          retailChurnRatio: "Retail Churn",
          whaleChurnRatio: "Whale Churn",
          uniqueBuyers: "Unique Buyers",
        }).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleLine(key)}
            className={`px-3 py-1 text-sm rounded border ${
              visibleLines[key]
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {visibleLines[key] ? `Hide ${label}` : `Show ${label}`}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={formattedData}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis dataKey="formattedTime" tick={{ fontSize: 11, fill: textColor }} />
          <YAxis domain={["auto", "auto"]} tick={{ fill: textColor }} />
          <Tooltip
            contentStyle={{
              backgroundColor: darkMode ? "#2d2d2d" : "#fff",
              borderColor: darkMode ? "#444" : "#ccc",
              color: textColor,
            }}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ color: textColor }} />

          {visibleLines.buyScore && (
            <Line
              type="monotone"
              dataKey="buyScore"
              name="Buy Score"
              stroke="#1e88e5"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          )}
          {visibleLines.retailChurnRatio && (
            <Line
              type="monotone"
              dataKey="retailChurnRatio"
              name="Retail Churn"
              stroke="#fbc02d"
              strokeWidth={2}
              strokeDasharray="5 2"
              dot={false}
              isAnimationActive={false}
            />
          )}
          {visibleLines.whaleChurnRatio && (
            <Line
              type="monotone"
              dataKey="whaleChurnRatio"
              name="Whale Churn"
              stroke="#e53935"
              strokeWidth={2}
              strokeDasharray="5 2"
              dot={false}
              isAnimationActive={false}
            />
          )}
          {visibleLines.uniqueBuyers && (
            <Line
              type="monotone"
              dataKey="uniqueBuyers"
              name="Unique Buyers"
              stroke="#43a047"
              strokeWidth={2}
              strokeDasharray="6 2"
              dot={false}
              isAnimationActive={false}
            />
          )}

          <Brush
            dataKey="formattedTime"
            height={30}
            stroke={"blue"}
            travellerWidth={10}
            startIndex={
              pageRef.current >= totalPage.current
                ? 0
                : Math.max(0, formattedData.length - (formattedData.length - 2))
            }
            endIndex={formattedData.length - 1}
            onChange={async (range) => {
              if (
                range &&
                typeof range.startIndex === "number" &&
                typeof range.endIndex === "number" &&
                !isEnd
              ) {
                const start = formattedData[range.startIndex];
                const end = formattedData[range.endIndex];
                if (
                  start &&
                  end &&
                  onZoomOrPan &&
                  range.startIndex < 2 &&
                  isLoaded &&
                  !throttleRef.current
                ) {
                  throttleRef.current = true;
                  setIsLoaded(false);

                  const report = await onZoomOrPan(pageRef.current, funtype);
                  if (report?.totalpage > 0) {
                    totalPage.current = report.totalpage;
                    if (report.totalpage > pageRef.current) {
                      pageRef.current = report.currentpage + 1;
                    } else {
                      setIsEnd(true);
                    }

                    setIsLoaded(true);
                    setTimeout(() => {
                      throttleRef.current = false;
                    }, 1000);
                  }
                }
              }
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
