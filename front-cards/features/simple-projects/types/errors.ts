/** UI payload for surfacing projects/API issues without leaking internals in the headline. */

export interface ProjectsErrorDisplay {
  headline: string;
  body: string;
  /** Shown collapsed under “Technical details”; safe for admins / developers. */
  technicalHint?: string;
}
