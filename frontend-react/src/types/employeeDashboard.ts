export interface AttendanceSummary {
  present:  number
  absent:   number
  halfDay:  number
  onLeave:  number
  total:    number  // working days in month so far
}
