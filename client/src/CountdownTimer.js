import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ dueDate }) => {
    const calculateTimeLeft = () => {
        const difference = +new Date(dueDate) - +new Date();
        let timeLeft = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        // Clear timeout if the component is unmounted
        return () => clearTimeout(timer);
    });

    const timerComponents = [];
    Object.keys(timeLeft).forEach((interval) => {
        if (!timeLeft[interval] && interval !== 'seconds' && timerComponents.length === 0) {
            return;
        }
        if(timeLeft[interval] > 0 || interval === 'seconds') {
            timerComponents.push(
                <span key={interval}>
                    {timeLeft[interval]} {interval}{" "}
                </span>
            );
        }
    });

    return (
        <div className="countdown-timer-card">
            <h4>Next Deadline:</h4>
            <div>
                {timerComponents.length ? timerComponents : <span>Time's up!</span>}
            </div>
        </div>
    );
};

export default CountdownTimer;