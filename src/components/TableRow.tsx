import React, { useState, useEffect } from "react";
import LineGraph from "./LineGraph";

let vol = "coin"
let t10 = "coin"
let trades = ["coin", "coin"]

const TableRow = ({ imageSrc, tkName, tkSymbl, usernames, tweets, impressionsData }: { imageSrc: any, tkName: any, tkSymbl: any, usernames: any, tweets: any, impressionsData: any[] }) => {
    return (
        <>
            <td className="px-4 py-2">
                <div className="flex items-center space-x-3" style={{ width: "100%" }}>
                    <div className="h-20 w-20 bg-gray-600 rounded-full flex-shrink-0">
                        <img src=/*{othermetadata?.image} */{imageSrc} alt="Profile" className="object-cover w-full h-full rounded-full" />
                    </div>
                    <div className="">
                        <p className="text-sm font-medium text-white"><b>{tkName}</b></p>
                        <div className="text-xs text-gray-400 space-y-1">
                            <p className=""><span className="text-white"><i>{tkSymbl}</i></span></p>
                            <p className="text-green-500">TV <span className="text-white">{vol}</span></p>
                            <p className="text-green-500">T10 <span className="text-white">{t10}</span></p>
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-4 py-0 h-20 overflow-y-auto">
                <div className="h-8 w-24">
                    <LineGraph data={impressionsData} color="#10B981" />
                </div>
            </td>
            <td className="px-4 py-2 text-xs text-center h-20 overflow-y-auto">
                {usernames && usernames.length > 0 ? (
                    <div className="space-x-1  h-20 overflow-y-auto">
                        {usernames.map((name: string, index: number) => (
                            <p key={index} className="text-gray-300">
                                {name}
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500">No Caller</p>
                )}
            </td>
            <td className="px-4 py-2 text-xs text-center h-20 overflow-y-auto">
                {tweets && tweets.length > 0 ? (
                    <div className="space-x-1  h-20 overflow-y-auto">
                        {tweets.map((name: string, index: number) => (
                            <p key={index} className="text-gray-300 w-24">
                                {name + "\n_____________________________\n"}
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500">No Tweets</p>
                )}
            </td>

        </>
    );
};


export default TableRow;
