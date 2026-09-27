// Opening hours as stored on business documents, and whether a place is
// open at a given moment in its own time zone.

export type DayHours = {
  closed: boolean;
  open: string;
  close: string;
};

export type Hours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

export type DayName = keyof Hours;

const dayOrder: DayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const toMinutes = (time: string) => {
  const [hour, minute] =
    time.split(":").map(Number);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return hour * 60 + minute;
};

export const getOpenStatus = (
  hours: Hours | undefined,
  timezone: string | undefined,
  nowMs: number
) => {
  if (!hours || !timezone) {
    return null;
  }

  try {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone: timezone,
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }
      ).formatToParts(
        new Date(nowMs)
      );

    const weekdayValue =
      parts
        .find(
          (part) =>
            part.type === "weekday"
        )
        ?.value.toLowerCase();

    const hourValue =
      parts.find(
        (part) =>
          part.type === "hour"
      )?.value;

    const minuteValue =
      parts.find(
        (part) =>
          part.type === "minute"
      )?.value;

    if (
      !weekdayValue ||
      hourValue === undefined ||
      minuteValue === undefined
    ) {
      return null;
    }

    const day =
      weekdayValue as DayName;

    const currentMinutes =
      Number(hourValue) * 60 +
      Number(minuteValue);

    const today =
      hours[day];

    let openNow = false;

    if (today && !today.closed) {
      const opening =
        toMinutes(today.open);

      const closing =
        toMinutes(today.close);

      if (
        opening !== null &&
        closing !== null
      ) {
        if (closing > opening) {
          openNow =
            currentMinutes >= opening &&
            currentMinutes < closing;
        } else {
          openNow =
            currentMinutes >= opening;
        }
      }
    }

    if (!openNow) {
      const currentIndex =
        dayOrder.indexOf(day);

      const previousDay =
        dayOrder[
          (currentIndex + 6) %
            dayOrder.length
        ];

      const previous =
        hours[previousDay];

      if (
        previous &&
        !previous.closed
      ) {
        const previousOpening =
          toMinutes(previous.open);

        const previousClosing =
          toMinutes(previous.close);

        if (
          previousOpening !== null &&
          previousClosing !== null &&
          previousClosing <=
            previousOpening &&
          currentMinutes <
            previousClosing
        ) {
          openNow = true;
        }
      }
    }

    return {
      open: openNow,
      day,
    };
  } catch (error) {
    console.error(
      "Could not calculate business open status:",
      error
    );

    return null;
  }
};
