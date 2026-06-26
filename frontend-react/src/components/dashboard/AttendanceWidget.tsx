import { useAuthStore } from '../../store/authStore'

export default function AttendanceWidget() {
  const { user } = useAuthStore()
  // Mock data for attendance layout, can be wired to useAttendance later
  const status = "Not Punched In"
  const punchIn = "--:--"
  const punchOut = "--:--"
  const workHours = "0h 0m"

  const isPunchedIn = false;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-900">Today's Attendance</h3>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isPunchedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {status}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Punch In</div>
          <div className="text-sm font-semibold text-gray-900">{punchIn}</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Punch Out</div>
          <div className="text-sm font-semibold text-gray-900">{punchOut}</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Working Hours</div>
          <div className="text-sm font-semibold text-blue-700">{workHours}</div>
        </div>
      </div>

      <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
        {isPunchedIn ? 'Punch Out' : 'Punch In'}
      </button>
    </div>
  )
}
