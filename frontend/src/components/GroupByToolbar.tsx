export type GroupByMode = 'none' | 'sender' | 'date' | 'subject';

interface Props {
  value: GroupByMode;
  onChange: (mode: GroupByMode) => void;
}

const modes: { value: GroupByMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sender', label: 'Sender' },
  { value: 'date', label: 'Date' },
  { value: 'subject', label: 'Subject' },
];

export default function GroupByToolbar({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 mr-1">Group by:</span>
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            value === m.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
