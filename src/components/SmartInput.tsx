import React, { useState } from 'react';
import { addDaysToDateString } from '../../shared/dates.js';

interface SmartInputProps {
  referenceDate: string;
  isAiAvailable: boolean;
  isLoading: boolean;
  onExtract: (text: string) => void;
  onManualEntry: (prefilledText?: string) => void;
}

export const SmartInput: React.FC<SmartInputProps> = ({
  referenceDate,
  isAiAvailable,
  isLoading,
  onExtract,
  onManualEntry,
}) => {
  const [text, setText] = useState('');

  const in2Days = addDaysToDateString(referenceDate, 2);
  const in5Days = addDaysToDateString(referenceDate, 5);
  const in7Days = addDaysToDateString(referenceDate, 7);

  const sampleWhatsApp = `🚨 Urgent reminder from Prof. Sharma (CS302):
The Database Systems Final Project submission deadline has been set for ${in2Days} at 23:59.
Submit your GitHub repo link and PDF report via the campus portal. Late submissions will receive a penalty.`;

  const sampleEmail = `Subject: Campus Annual Tech Symposium & Hackathon 2026
Dear Students,
The Department of Computing is delighted to host InnovateX 2026 on ${in5Days} starting at 09:30 in the Main Campus Auditorium.
Registration closes on ${in2Days} at 18:00. Teams of 2 to 4 students are welcome.`;

  const samplePoster = `🎨 DESIGN CLUB WORKSHOP: UI/UX Prototyping
Date: ${in7Days}
Time: 14:00 - 17:00
Venue: Design Studio B, Block 3
Hands-on Figma masterclass. Bring your own laptop! Free stickers for all attendees.`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onExtract(text.trim());
  };

  const handleManualClick = () => {
    onManualEntry(text.trim());
  };

  return (
    <div className="smart-input-container">
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: '4px' }}>
          Paste an Announcement
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Turn messy WhatsApp messages, emails, and poster captions into organised, prioritised campus notices.
        </p>
      </div>

      {!isAiAvailable && (
        <div
          role="status"
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: 'var(--font-size-sm)',
            color: '#1e40af',
          }}
        >
          <strong>Notice:</strong> AI extraction is not configured on this server (GEMINI_API_KEY unset).
          You can try sample announcements or enter notices manually.
        </div>
      )}

      <div className="sample-buttons-group" role="group" aria-label="Sample campus announcements">
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-subtle)' }}>
          Try a sample announcement:
        </span>
        <button
          type="button"
          className="sample-btn"
          onClick={() => setText(sampleWhatsApp)}
        >
          📱 WhatsApp Assignment
        </button>
        <button
          type="button"
          className="sample-btn"
          onClick={() => setText(sampleEmail)}
        >
          📧 Symposium Email
        </button>
        <button
          type="button"
          className="sample-btn"
          onClick={() => setText(samplePoster)}
        >
          🎨 Workshop Poster
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="textarea-wrapper">
          <label htmlFor="announcement-textarea" className="form-label">
            Announcement Text <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            id="announcement-textarea"
            className="smart-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={8000}
            rows={6}
            placeholder="Paste your WhatsApp notice, email announcement, or event details here..."
            aria-describedby={!isAiAvailable ? 'ai-disabled-desc' : undefined}
          />
          <div className="textarea-footer">
            <span>Maximum 8,000 characters</span>
            <span style={{ color: text.length > 7500 ? '#dc2626' : 'var(--color-text-subtle)' }}>
              {text.length} / 8000
            </span>
          </div>
        </div>

        {!isAiAvailable && (
          <span id="ai-disabled-desc" className="sr-only">
            AI extraction is disabled because GEMINI_API_KEY is not configured on this server.
          </span>
        )}

        <div className="smart-input-actions" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!text.trim() || isLoading || !isAiAvailable}
              aria-busy={isLoading}
            >
              {isLoading && <span className="spinner" aria-hidden="true" />}
              {isLoading ? 'Extracting with AI...' : 'Extract with AI'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleManualClick}
            >
              Enter manually instead
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
