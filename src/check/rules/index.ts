import type { Rule } from "../types.js";
import { SHAPE_RULES } from "./shape.js";
import { BADGE_RULES } from "./badges.js";
import { PROSE_RULES } from "./prose.js";
import { VISUAL_RULES } from "./visuals.js";
import { PRIVACY_RULES } from "./privacy.js";
import { LINK_RULES } from "./links.js";
import { REGISTRY_RULES } from "./registry.js";

export const RULES: Rule[] = [...SHAPE_RULES, ...BADGE_RULES, ...PROSE_RULES, ...VISUAL_RULES, ...PRIVACY_RULES, ...LINK_RULES, ...REGISTRY_RULES];
