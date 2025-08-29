'use client';
import VehicleSelector from './VehicleSelector';

type Props = {
  onChange?: (selection: {
    year?: number;
    make?: string;
    model?: string;
    trim_label?: string;
  }) => void;
};

export default function VehiclePickerClient({ onChange }: Props) {
  console.log('VehiclePickerClient received onChange:', !!onChange); // Debug log
  return <VehicleSelector onChange={onChange} />;
}
