'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface StocktakeItem {
  id: string;
  category: string;
  item_name: string;
  product_code: string;
  unit: string;
  par_level: number;
  current_stock: number;
  order_qty: number;
}

interface StocktakeLog {
  id: string;
  order_number: string;
  stocktake_date: string;
  conducted_by: string;
  urgency: string;
  recipient_emails: string[];
  total_items_ordered: number;
  email_sent: boolean;
  created_at: string;
}

export default function StocktakePage() {
  const [items, setItems] = useState<StocktakeItem[]>([]);
  const [logs, setLogs] = useState<StocktakeLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'check' | 'history'>('check');

  const [stocktakeDate, setStocktakeDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [conductedBy, setConductedBy] = useState<string>('MJ Hygiene Site Supervisor');
  const [urgency, setUrgency] = useState<string>('Standard Weekly Order');
  const [recipientEmails, setRecipientEmails] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string; orderId?: string } | null>(null);

  // Add custom item state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<string>('Paper & Washroom Consumables');
  const [newItemName, setNewItemName] = useState<string>('');
  const [newUnit, setNewUnit] = useState<string>('Carton');
  const [newPar, setNewPar] = useState<number>(10);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stocktake');
      const json = await res.json();
      const loadedItems: StocktakeItem[] = (json.items ?? []).map((i: StocktakeItem) => ({
        ...i,
        order_qty: Math.max(0, Number(i.par_level) - Number(i.current_stock)),
      }));
      setItems(loadedItems);
      setLogs(json.logs ?? []);
      if (Array.isArray(json.defaultRecipients) && json.defaultRecipients.length > 0 && !recipientEmails) {
        setRecipientEmails(json.defaultRecipients.join(', '));
      }
    } finally {
      setLoading(false);
    }
  }, [recipientEmails]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStockChange = (id: string, field: 'current_stock' | 'par_level' | 'order_qty', val: number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: Math.max(0, val) };
        if (field === 'current_stock' || field === 'par_level') {
          next.order_qty = Math.max(0, next.par_level - next.current_stock);
        }
        return next;
      })
    );
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const res = await fetch('/api/stocktake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_item',
        category: newCategory,
        item_name: newItemName.trim(),
        unit: newUnit,
        par_level: newPar,
        current_stock: newPar,
      }),
    });
    if (res.ok) {
      setNewItemName('');
      setShowAddModal(false);
      await loadData();
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const res = await fetch('/api/stocktake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stocktake_date: stocktakeDate,
          conducted_by: conductedBy,
          urgency,
          recipient_emails: recipientEmails,
          notes,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit stocktake order');

      await loadData();
      setToast({
        type: 'success',
        text: `Stocktake Order ${json.data.order_number} recorded${
          json.data.email_sent
            ? ` and emailed to ${json.recipientsNotified.join(', ')}!`
            : '!'
        }`,
        orderId: json.data.id,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error submitting stocktake order',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const categories = Array.from(new Set(items.map(i => i.category)));
  const totalLinesToOrder = items.filter(i => i.order_qty > 0).length;
  const totalUnitsToOrder = items.reduce((sum, i) => sum + (Number(i.order_qty) || 0), 0);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7' }}>
            Nu-Pure Beverages — Stapylton Site Consumables
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '4px 0 6px' }}>
            Weekly Consumables Stocktake &amp; Requisition Order
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Record current on-hand stock across site amenities &amp; cleaner stores. The portal automatically calculates order quantities and emails the requisition to Nu-Pure.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Add Consumable Item
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'check' ? 'history' : 'check')}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#0f3460',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {activeTab === 'check' ? `Order History (${logs.length})` : '← Back to Stocktake Check'}
          </button>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <form
          onSubmit={handleAddItem}
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Category</label>
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Item Name</label>
            <input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="e.g. Jumbo Toilet Rolls"
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Unit</label>
            <input
              type="text"
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              placeholder="Carton / Pack / 5L Drum"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Site Par Level</label>
            <input
              type="number"
              min={1}
              value={newPar}
              onChange={e => setNewPar(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save Item
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: toast.type === 'success' ? '#15803d' : '#dc2626',
            padding: '14px 18px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{toast.text}</span>
          {toast.orderId && (
            <Link
              href={`/stocktake/${toast.orderId}`}
              style={{
                background: '#15803d',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              View / Print Order Sheet →
            </Link>
          )}
        </div>
      )}

      {activeTab === 'check' ? (
        <form onSubmit={handleSubmitOrder}>
          {/* Order Details Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Stocktake Date
              </label>
              <input
                type="date"
                value={stocktakeDate}
                onChange={e => setStocktakeDate(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Conducted By
              </label>
              <input
                type="text"
                value={conductedBy}
                onChange={e => setConductedBy(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Order Priority
              </label>
              <select
                value={urgency}
                onChange={e => setUrgency(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              >
                <option value="Standard Weekly Order">Standard Weekly Order</option>
                <option value="Urgent Restock Required">Urgent Restock Required</option>
                <option value="Monthly Bulk Replenishment">Monthly Bulk Replenishment</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Email Order To (Nu-Pure &amp; MJ Hygiene)
              </label>
              <input
                type="text"
                value={recipientEmails}
                onChange={e => setRecipientEmails(e.target.value)}
                placeholder="purchasing@nupure.com.au, admin@mjhygiene.com.au"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>
          </div>

          {/* Consumables Table by Category */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading Nu-Pure Consumables Catalogue...</div>
          ) : (
            categories.map(cat => {
              const catItems = items.filter(i => i.category === cat);
              return (
                <div
                  key={cat}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '12px 18px',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#0f3460',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {cat} ({catItems.length} items)
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 18px' }}>Consumable Item</th>
                        <th style={{ padding: '10px 18px' }}>Unit</th>
                        <th style={{ padding: '10px 18px', width: 140 }}>Site Par Level</th>
                        <th style={{ padding: '10px 18px', width: 150 }}>On-Hand Count</th>
                        <th style={{ padding: '10px 18px', width: 150 }}>Order Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0f172a' }}>
                            {item.item_name}
                            {item.product_code ? (
                              <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                ({item.product_code})
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: '12px 18px', color: '#475569', fontWeight: 600 }}>{item.unit}</td>
                          <td style={{ padding: '12px 18px' }}>
                            <input
                              type="number"
                              min={0}
                              value={item.par_level}
                              onChange={e => handleStockChange(item.id, 'par_level', Number(e.target.value))}
                              style={{
                                width: 90,
                                padding: '7px 10px',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                fontWeight: 700,
                              }}
                            />
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <input
                              type="number"
                              min={0}
                              value={item.current_stock}
                              onChange={e => handleStockChange(item.id, 'current_stock', Number(e.target.value))}
                              style={{
                                width: 90,
                                padding: '7px 10px',
                                borderRadius: 8,
                                border: '1px solid #0284c7',
                                background: '#f0f9ff',
                                fontWeight: 800,
                                color: '#0f172a',
                              }}
                            />
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <input
                              type="number"
                              min={0}
                              value={item.order_qty}
                              onChange={e => handleStockChange(item.id, 'order_qty', Number(e.target.value))}
                              style={{
                                width: 90,
                                padding: '7px 10px',
                                borderRadius: 8,
                                border: item.order_qty > 0 ? '2px solid #16a34a' : '1px solid #cbd5e1',
                                background: item.order_qty > 0 ? '#f0fdf4' : '#ffffff',
                                fontWeight: 800,
                                color: item.order_qty > 0 ? '#15803d' : '#64748b',
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}

          {/* Notes & Submit Bar */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ flex: '1 1 360px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Delivery Instructions / Requisition Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Deliver to Stapylton Gatehouse / Cleaner Store Room..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Order Summary</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f3460' }}>
                  {totalLinesToOrder} Lines ({totalUnitsToOrder} Total Units)
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: 'linear-gradient(135deg, #0f3460, #0284c7)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting & Emailing Order...' : 'Submit Stocktake & Email Order to Nu-Pure →'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* History Tab */
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Order #</th>
                <th style={{ padding: '12px 16px' }}>Date</th>
                <th style={{ padding: '12px 16px' }}>Conducted By</th>
                <th style={{ padding: '12px 16px' }}>Urgency</th>
                <th style={{ padding: '12px 16px' }}>Items Ordered</th>
                <th style={{ padding: '12px 16px' }}>Email Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Order Sheet</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                    No stocktake orders submitted yet.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f3460' }}>{log.order_number}</td>
                    <td style={{ padding: '12px 16px' }}>{log.stocktake_date}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.conducted_by}</td>
                    <td style={{ padding: '12px 16px' }}>{log.urgency}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>
                      {log.total_items_ordered} line(s)
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: log.email_sent ? '#dcfce7' : '#f1f5f9',
                          color: log.email_sent ? '#15803d' : '#475569',
                        }}
                      >
                        {log.email_sent ? 'EMAILED ✓' : 'LOGGED'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Link
                        href={`/stocktake/${log.id}`}
                        style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
                      >
                        View / Print →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
