import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
  } from 'recharts';
  import { ChevronsUpDown } from 'lucide-react';

const ChartsSection = () => {
    const revenueData = [
      { day: 'Mon', value: 95000 },
      { day: 'Tue', value: 15000 },
      { day: 'Wed', value: 18000 },
      { day: 'Thu', value: 28000 },
      { day: 'Fri', value: 55000 },
      { day: 'Sat', value: 45000 },
      { day: 'Sun', value: 22000 }
    ];
  
    const enrollmentData = [
      { name: 'Mon', value: 4, color: '#8979FF' },
      { name: 'Tue', value: 4, color: '#63E6E2' },
      { name: 'Wed', value: 8, color: '#64D3FF' },
      { name: 'Thu', value: 6, color: '#FF9F0B' },
      { name: 'Fri', value: 7, color: '#007AFF' },
      { name: 'Sat', value: 2, color: '#35C759' },
      { name: 'Sun', value: 3, color: '#AF52DE' }
    ];
  
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
       
        <div
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Statistics</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>This week</span>
              <ChevronsUpDown size={16} />
            </div>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 20, right: 10, left: 20, bottom: 5 }}
              barCategoryGap={5}>
                <XAxis 
                  dataKey="day" 
                  axisLine={true}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  ticks={[0, 20000, 40000, 60000, 80000, 100000]}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3749CB" 
                  radius={[50, 50, 0, 0]}
                  maxBarSize={31}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
  
        
        <div
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Enrollment Statistics</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>This week</span>
              <ChevronsUpDown size={16} />
            </div>
          </div>
          
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={enrollmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                     radius={50}
                      dataKey="value"
                    >
                      {enrollmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">43</span>
              </div>
            </div>
            
            <div className="ml-8 space-y-3">
              {enrollmentData.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };
  export default ChartsSection