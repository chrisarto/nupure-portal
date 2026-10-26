// Test date parser and timezone logic

function getAestDayUtcRange(isoStringOrYmd) {
  if (!isoStringOrYmd) return null;
  let ymd = isoStringOrYmd;
  if (isoStringOrYmd.includes('T')) {
    const d = new Date(isoStringOrYmd);
    const aestTime = new Date(d.getTime() + 10 * 3600000);
    ymd = aestTime.toISOString().split('T')[0];
  }
  return {
    startUtc: new Date(`${ymd}T00:00:00+10:00`).toISOString(),
    endUtc: new Date(`${ymd}T23:59:59.999+10:00`).toISOString(),
    ymd
  };
}

function parseDateFromSubject(subject) {
  if (!subject) return null;

  const matchSlash = subject.match(/(?:Pre-?Op|monitoring)[^0-9]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i);
  if (matchSlash) {
    const day = matchSlash[1].padStart(2, '0');
    const month = matchSlash[2].padStart(2, '0');
    let year = matchSlash[3];
    if (year.length === 2) {
      if (year === '16') year = '26';
      year = '20' + year;
    }
    const d = new Date(`${year}-${month}-${day}T00:00:00+10:00`);
    return isNaN(d.valueOf()) ? null : d.toISOString();
  }

  const matchDigits = subject.match(/(\d{2})(\d{2})(\d{2})(?!\d)/g);
  if (matchDigits && matchDigits.length > 0) {
    const lastDigits = matchDigits[matchDigits.length - 1];
    const day = lastDigits.substring(0, 2);
    const month = lastDigits.substring(2, 4);
    let yearPart = lastDigits.substring(4, 6);
    if (yearPart === '16') yearPart = '26';
    const year = '20' + yearPart;

    const dNum = parseInt(day, 10);
    const mNum = parseInt(month, 10);
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
      const d = new Date(`${year}-${month}-${day}T00:00:00+10:00`);
      return isNaN(d.valueOf()) ? null : d.toISOString();
    }
  }

  return null;
}

const subjects = [
  'Gotzinger Smallgoods Pre-Op - 21/10/16',
  'Gotzinger Smallgoods Pre-Op - 17+191026',
  'Gotzinger Smallgoods - 140926 Pre-Op',
  'Gotzinger Smallgoods Pre-Op - 15/09/26',
  'Gotzinger Smallgoods Pre-Op 02/10/26',
  'Gotzinger Smallgoods Pre-Op - 10/10/26'
];

subjects.forEach(s => {
  const parsed = parseDateFromSubject(s);
  const range = getAestDayUtcRange(parsed);
  console.log(`Subject: "${s}"`);
  console.log(`  Parsed: ${parsed}`);
  console.log(`  AEST Date: ${range?.ymd}`);
  console.log(`  UTC Range: [${range?.startUtc} .. ${range?.endUtc}]\n`);
});
