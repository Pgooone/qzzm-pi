import type { RoleId } from "./modelConfig.js"
import { buildPrdTools } from "./tools/prdTools.js"
import { buildDesignTools } from "./tools/designTools.js"
import { buildDevTools } from "./tools/devTools.js"

export function toolsForRole(role: RoleId, projectId: string) {
  switch (role) {
    case "prd":
      return buildPrdTools(projectId)
    case "design":
      return buildDesignTools(projectId)
    case "dev":
      return buildDevTools(projectId)
    default:
      return []
  }
}
