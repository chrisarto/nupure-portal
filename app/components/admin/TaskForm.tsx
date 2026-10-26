'use client';

import { useState } from 'react';
import type { SanitationTask } from '@/lib/types';
import shared from '@/app/(portal)/shared.module.css';

interface TaskFormProps {
  initialData?: Partial<SanitationTask>;
  onSave: (data: Partial<SanitationTask>) => Promise<void>;
  onCancel: () => void;
}

export function TaskForm({ initialData = {}, onSave, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState<Partial<SanitationTask>>({
    cleaningTask: initialData.cleaningTask || '',
    area: initialData.area || '',
    area2: initialData.area2 || '',
    department: initialData.department || '',
    assetElement: initialData.assetElement || '',
    cleaningFrequency: initialData.cleaningFrequency || '',
    frequencyInDays: initialData.frequencyInDays || 0,
    permitRequirement: initialData.permitRequirement || '',
    docGotzinger: initialData.docGotzinger || '',
    areaGroup: initialData.areaGroup || '',
    procedureSignOffUrl: initialData.procedureSignOffUrl || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSave(formData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    marginTop: '4px',
    fontFamily: 'inherit'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-light)',
    marginBottom: '12px'
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '20px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <label style={labelStyle}>
          Cleaning Task *
          <input required name="cleaningTask" value={formData.cleaningTask} onChange={handleChange} style={inputStyle} />
        </label>
        
        <label style={labelStyle}>
          Asset Element / Scope
          <input name="assetElement" value={formData.assetElement} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Area (e.g. High Risk)
          <input required name="area" value={formData.area} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Sub-Area
          <input name="area2" value={formData.area2} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Department
          <input required name="department" value={formData.department} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Area Group
          <input name="areaGroup" value={formData.areaGroup} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Cleaning Frequency (Text)
          <input name="cleaningFrequency" value={formData.cleaningFrequency} onChange={handleChange} placeholder="e.g. Daily, Weekly" style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Frequency in Days
          <input type="number" name="frequencyInDays" value={formData.frequencyInDays || ''} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Permit Requirement
          <select name="permitRequirement" value={formData.permitRequirement} onChange={handleChange} style={inputStyle}>
            <option value="">No Permit Required</option>
            <option value="Heights">Heights</option>
            <option value="Confined Space">Confined Space</option>
            <option value="General">General</option>
          </select>
        </label>

        <label style={labelStyle}>
          Nu-Pure Document Reference
          <input name="docGotzinger" value={formData.docGotzinger} onChange={handleChange} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Procedure Sign-off URL
          <input type="url" name="procedureSignOffUrl" value={formData.procedureSignOffUrl} onChange={handleChange} placeholder="https://..." style={inputStyle} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }} disabled={loading}>
          Cancel
        </button>
        <button type="submit" style={{ padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={loading}>
          {loading ? 'Saving...' : 'Save Task'}
        </button>
      </div>
    </form>
  );
}
