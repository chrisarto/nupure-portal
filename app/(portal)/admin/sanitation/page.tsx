'use client';

import { useState, useEffect, useCallback } from 'react';
import shared from '@/app/(portal)/shared.module.css';
import type { SanitationTask } from '@/lib/types';
import { TaskForm } from '@/app/components/admin/TaskForm';

export default function AdminSanitationPage() {
  const [tasks, setTasks] = useState<SanitationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTask, setCurrentTask] = useState<Partial<SanitationTask> | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sanitation');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const json = await res.json();
      setTasks(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handleSave = async (data: Partial<SanitationTask>) => {
    const method = data.id ? 'PUT' : 'POST';
    const res = await fetch('/api/admin/sanitation', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || 'Failed to save task');
    }

    await fetchTasks();
    setIsEditing(false);
    setCurrentTask(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const res = await fetch(`/api/admin/sanitation?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchTasks();
    } catch (err) {
      alert('Error deleting task');
    }
  };

  if (isEditing) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 className={shared.pageTitle} style={{ marginBottom: '20px' }}>
          {currentTask?.id ? 'Edit Task' : 'Create New Task'}
        </h2>
        <TaskForm 
          initialData={currentTask || {}} 
          onSave={handleSave} 
          onCancel={() => { setIsEditing(false); setCurrentTask(null); }} 
        />
      </div>
    );
  }

  return (
    <>
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Sanitation Management</h1>
            <p className={shared.pageDescription}>Manage cleaning tasks and schedules directly in Supabase</p>
          </div>
          <button 
            className={shared.primaryBtn} 
            onClick={() => { setCurrentTask(null); setIsEditing(true); }}
            style={{ padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Add New Task
          </button>
        </div>
      </div>

      {error && <div className={shared.errorState}>{error}</div>}

      {loading ? (
         <div className={shared.skeleton} style={{ height: '400px' }} />
      ) : (
        <div className={shared.tableWrapper}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Cleaning Task</th>
                <th>Area</th>
                <th>Department</th>
                <th>Frequency</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td><strong>{task.cleaningTask}</strong></td>
                  <td>{task.area}</td>
                  <td>{task.department}</td>
                  <td>{task.cleaningFrequency}</td>
                  <td>
                    <button 
                      onClick={() => { setCurrentTask(task); setIsEditing(true); }}
                      style={{ marginRight: '10px', background: 'transparent', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(task.id)}
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No tasks found. Click "Add New Task" to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
