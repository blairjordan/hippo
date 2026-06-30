export const hippoProcessRoles = ["serve", "work", "all"] as const

export type HippoProcessRole = (typeof hippoProcessRoles)[number]

export const servesHttp = (role: HippoProcessRole) =>
  role === "serve" || role === "all"

export const runsBackgroundLoops = (role: HippoProcessRole) =>
  role === "work" || role === "all"
