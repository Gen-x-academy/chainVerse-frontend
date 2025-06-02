import React from 'react';

import { TrendingUp, TrendingDown , ChevronsUpDown} from 'lucide-react';

const OverviewCards = () => {
    const cards = [
      {
        title: 'Total Enrollment',
        value: '200',
        change: '+37%',
        trend: 'up',
        subtitle: '',
        color: 'bg-[#D9DFFC]'
      },
      {
        title: 'Total Completion',
        value: '100',
        change: '',
        trend: 'down',
        color: 'bg-[#FFDCCC]'
      },
      {
        title: 'Total Revenue',
        value: 'XLM 5436.78',
        subtitle: '$100,000',
        change: '',
        trend: 'down',
        color: 'bg-[#D9DFFC]'
      },
      {
        title: 'Course ratings',
        value: '4.8',
        subtitle: '348 reviews',
        change: '',
        trend: 'down',
        color: 'bg-[#FFDCCC]'
      }
    ];
  
    return (
       <>
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <span className='font-bold'>Today</span>
              <ChevronsUpDown size={16} />
            </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {cards.map((card, index) => (
          <div
            key={card.title}
            className={`${card.color} border rounded-xl p-6 relative overflow-hidden`}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className={`text-sm font-medium ${index === 0 || index === 2 ? 'text-[#4361EE]' : 'text-[#FE5000]'}`}>{card.title}</h3>
              {card.trend === 'up' ? (
                <TrendingUp className="text-green-500" size={16} />
              ) : (
                <TrendingDown className="text-red-400" size={16} />
              )}
            </div>
            
            <div className={`space-y-1 ${index < 2 ? 'flex justify-between pt-7 items-center' : 'flex flex-col justify-start'}`}>
              <div className="text-xl font-bold text-gray-900">{card.value}</div>
              {card.subtitle && (
                <div className={`text-sm font-medium ${index === 2 ? 'text-[#4361EE]' : ' text-[#FE5000]'}`}>{card.subtitle}</div>
              )}
              {card.change && (
                <div className={`text-sm font-medium ${index === 2 ? 'text-red-500' : ' '}`}>{card.change}</div>
              )}
            </div>
          </div>
        ))}
      </div>
       
       
       </>
    );
  };
  export default OverviewCards