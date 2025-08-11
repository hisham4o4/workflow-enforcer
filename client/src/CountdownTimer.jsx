import React, { useEffect, useState } from 'react';

/**
 * CountdownTimer
 * - receives a dueDate ISO string
 * - displays days/hours/mins/secs remaining
 * - calls onExpire when timer reaches zero
 */
export default function CountdownTimer({ dueDate, onExpire }) {
  const getDelta = () => Math.max(0, new Date(dueDate).getTime() - Date.now());
  const [delta, setDelta] = useState(getDelta());

  useEffect(() => {
    const id = setInterval(() => {
      const d = getDelta();
      setDelta(d);
      if (d <= 0) {
        clearInterval(id);
        onExpire && onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [dueDate, onExpire]);

  const sec = Math.floor(delta / 1000) % 60;
  const min = Math.floor(delta / (1000 * 60)) % 60;
  const hrs = Math.floor(delta / (1000 * 60 * 60)) % 24;
  const days = Math.floor(delta / (1000 * 60 * 60 * 24));

  return (
    <div className="countdown-timer" title={`Due: ${new Date(dueDate).toLocaleString()}`}>
      {delta > 0 ? (
        <span>{days}d {hrs}h {min}m {sec}s</span>
      ) : (
        <span>Due / Overdue</span>
      )}
    </div>
  );
}
