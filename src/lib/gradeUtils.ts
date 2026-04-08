const GRADE_SEQUENCE = [
  '小一', '小二', '小三', '小四', '小五', '小六',
  '國一', '國二', '國三',
  '高一', '高二', '高三',
  '已畢業'
];

export function getPromotedGrade(currentGrade: string): string {
  const index = GRADE_SEQUENCE.indexOf(currentGrade);
  if (index === -1) return currentGrade; // Unknown grade, don't promote
  if (index === GRADE_SEQUENCE.length - 1) return currentGrade; // Already graduated
  return GRADE_SEQUENCE[index + 1];
}

export function shouldPromote(lastPromotedYear: number | undefined, createdAt: any): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentDay = now.getDate();

  // Promotion day is 7/1
  const isPastPromotionDay = currentMonth > 7 || (currentMonth === 7 && currentDay >= 1);

  if (!isPastPromotionDay) return false;

  // If never promoted, check if it was created before this year's promotion day
  if (lastPromotedYear === undefined) {
    if (!createdAt) return true; // Assume old if no date
    const createdDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const createdYear = createdDate.getFullYear();
    const createdMonth = createdDate.getMonth() + 1;
    const createdDay = createdDate.getDate();

    const wasCreatedBeforeThisYearPromotion = createdYear < currentYear || 
      (createdYear === currentYear && (createdMonth < 7 || (createdMonth === 7 && createdDay < 1)));

    return wasCreatedBeforeThisYearPromotion;
  }

  // If already promoted this year, don't promote again
  return lastPromotedYear < currentYear;
}
