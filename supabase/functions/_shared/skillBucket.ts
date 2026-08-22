export type SkillBucket = "strong" | "moderate" | "developing" | "gap";

export function skillBucket(skill: {
  category?: unknown;
  proficiency_level?: unknown;
}): SkillBucket | null {
  const category = (skill.category || "").toString().toLowerCase().trim();
  if (category === "strong") return "strong";
  if (category === "moderate") return "moderate";
  if (category === "developing") return "developing";
  if (category === "gap") return "gap";

  const proficiency = (skill.proficiency_level || "").toString().toLowerCase().trim();
  if (proficiency === "strong") return "strong";
  if (proficiency === "moderate") return "moderate";
  if (proficiency === "developing" || proficiency.includes("beginner")) return "developing";
  if (proficiency === "gap") return "gap";
  return null;
}
