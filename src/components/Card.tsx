import React, { useState, useEffect } from "react";

const Card = ({ imageSrc, tkName, tkSymbl, usernames, tweets }: { imageSrc: any, tkName: any, tkSymbl: any, usernames: any, tweets: any }) => {

    return (
        <div className="min-w-[120px] bg-gray-800 p-2 rounded-lg shadow-md">
            <div className="h-12 w-12 bg-gray-600 rounded-full mb-2">
                <img src={imageSrc} alt="Profile" className="object-cover w-full h-full rounded-full" />
            </div>
            <p className="text-xs">{tkName}</p>
            <p className="text-xs text-gray-400">{tkSymbl}</p>
        </div>
    );
};

export default Card;
