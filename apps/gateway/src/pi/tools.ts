import type { RoleId } from "./modelConfig.js"
import { buildPrdTools } from "./tools/prdTools.js"
import { buildDesignTools } from "./tools/designTools.js"

export function toolsForRole(role: RoleId, projectId: string) {
  switch (role) {
    case "prd":
      return buildPrdTools(projectId)
    case "design":
      return buildDesignTools(projectId)
    default:
      return []
  }
}
