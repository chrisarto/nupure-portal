'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface StocktakeOrderDetail {
  id: string;
  order_number: string;
  stocktake_date: string;
  conducted_by: string;
  urgency: string;
  recipient_emails: string[];
  notes: string | null;
  items: Array<{
    category: string;
    item_name: string;
    unit: string;
    par_level: number;
    current_stock: number;
    order_qty: number;
  }>;
  total_items_ordered: number;
  email_sent: boolean;
  created_at: string;
}

export default function StocktakeOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<StocktakeOrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/stocktake/${params.id}`)
      .then(r => r.json())
      .then(j => setOrder(j.data ?? null))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading Stocktake Order...</div>;
  }

  if (!order) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontWeight: 700 }}>Stocktake Order not found.</p>
        <Link href="/stocktake" style={{ color: '#0284c7', fontWeight: 700 }}>
          ← Back to Stocktake &amp; Orders
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link href="/stocktake" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
          ← Back to Stocktake &amp; Consumable Orders
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#0f3460',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🖨️ Print / Save Order PDF
        </button>
      </div>

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0f3460, #0284c7)',
            color: '#ffffff',
            padding: '26px 32px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bae6fd' }}>
            MJ Hygiene Services &bull; Nu-Pure Beverages (Stapylton)
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>
            Consumable Stocktake &amp; Requisition Order
          </h1>
          <div style={{ fontSize: 13, color: '#e0f2fe' }}>
            Order Ref: <strong>{order.order_number}</strong> &bull; Date: <strong>{order.stocktake_date}</strong> &bull; Priority: <strong>{order.urgency}</strong>
          </div>
        </div>

        <div style={{ padding: 32 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              padding: 18,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Conducted By</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{order.conducted_by}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Lines Requested</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                {order.total_items_ordered} Consumable Line(s)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Order Emailed To</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 2 }}>
                {Array.isArray(order.recipient_emails) && order.recipient_emails.length > 0
                  ? order.recipient_emails.join(', ')
                  : 'Logged in Portal'}
              </div>
            </div>
          </div>

          {order.notes && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
                color: '#92400e',
              }}
            >
              <strong>Delivery / Order Notes:</strong> {order.notes}
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, border: '1px solid #e2e8f0' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                <th style={{ padding: '10px 14px' }}>Category</th>
                <th style={{ padding: '10px 14px' }}>Consumable Item</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Par Level</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>On Hand</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: item.order_qty > 0 ? '#f0fdf4' : '#ffffff',
                  }}
                >
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{item.category}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{item.item_name}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>
                    {item.par_level} {item.unit}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>
                    {item.current_stock} {item.unit}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      textAlign: 'center',
                      fontWeight: 800,
                      color: item.order_qty > 0 ? '#15803d' : '#94a3b8',
                    }}
                  >
                    {item.order_qty} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
