import React, { useState } from 'react';
import {
  Category,
  CATEGORIES,
  isValidCalendarDate,
  isValidTime,
  Notice,
} from '../../shared/schema.js';

interface NoticeFormProps {
  initialNotice?: Notice | null;
  initialOriginalText?: string;
  onSave: (notice: Notice) => void;
  onCancel: () => void;
}

export const NoticeForm: React.FC<NoticeFormProps> = ({
  initialNotice,
  initialOriginalText = '',
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(initialNotice);

  const [title, setTitle] = useState(initialNotice?.title || '');
  const [category, setCategory] = useState<Category>(initialNotice?.category || 'Academic');
  const [description, setDescription] = useState(initialNotice?.description || '');
  const [eventDate, setEventDate] = useState(initialNotice?.eventDate || '');
  const [eventTime, setEventTime] = useState(initialNotice?.eventTime || '');
  const [venue, setVenue] = useState(initialNotice?.venue || '');
  const [deadlineDate, setDeadlineDate] = useState(initialNotice?.deadlineDate || '');
  const [deadlineTime, setDeadlineTime] = useState(initialNotice?.deadlineTime || '');
  const [originalText] = useState(initialNotice?.originalText || initialOriginalText || 'Entered manually');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!title.trim()) {
      nextErrors.title = 'Title is required (1-120 characters)';
    } else if (title.trim().length > 120) {
      nextErrors.title = 'Title must be 120 characters or less';
    }

    if (description && description.length > 1000) {
      nextErrors.description = 'Description must be 1000 characters or less';
    }

    if (eventDate) {
      if (!isValidCalendarDate(eventDate)) {
        nextErrors.eventDate = 'Event date must be a valid calendar date (YYYY-MM-DD)';
      }
    }

    if (eventTime) {
      if (!isValidTime(eventTime)) {
        nextErrors.eventTime = 'Event time must be in HH:mm 24h format';
      }
    }

    if (deadlineDate) {
      if (!isValidCalendarDate(deadlineDate)) {
        nextErrors.deadlineDate = 'Deadline date must be a valid calendar date (YYYY-MM-DD)';
      }
    }

    if (deadlineTime) {
      if (!isValidTime(deadlineTime)) {
        nextErrors.deadlineTime = 'Deadline time must be in HH:mm 24h format';
      }
    }

    if (venue && venue.length > 200) {
      nextErrors.venue = 'Venue must be 200 characters or less';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const nowIso = new Date().toISOString();

    const noticeToSave: Notice = {
      id: initialNotice?.id || crypto.randomUUID(),
      title: title.trim(),
      category,
      description: description.trim() ? description.trim() : null,
      eventDate: eventDate || null,
      eventTime: eventTime || null,
      venue: venue.trim() ? venue.trim() : null,
      deadlineDate: deadlineDate || null,
      deadlineTime: deadlineTime || null,
      originalText: originalText.slice(0, 8000),
      contentHash: initialNotice?.contentHash || 'manual-' + Date.now(),
      reviewRequired: false,
      reviewWarnings: initialNotice?.reviewWarnings || [],
      createdAt: initialNotice?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    onSave(noticeToSave);
  };

  return (
    <form className="modal-card" onSubmit={handleSubmit} noValidate>
      <div className="modal-header">
        <h2>{isEditing ? 'Edit Campus Notice' : 'Enter Campus Notice Manually'}</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="form-title" className="form-label">
          Notice Title <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          id="form-title"
          type="text"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          aria-required="true"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'form-title-error' : undefined}
          placeholder="e.g. CS201 Assignment 3 Submission"
        />
        {errors.title && (
          <span id="form-title-error" className="form-error" role="alert">
            {errors.title}
          </span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="form-category" className="form-label">
            Category <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            id="form-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="form-venue" className="form-label">
            Venue / Location
          </label>
          <input
            id="form-venue"
            type="text"
            className="form-input"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            maxLength={200}
            placeholder="e.g. Auditorium / Room 402 / Zoom"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="form-event-date" className="form-label">
            Event Date (YYYY-MM-DD)
          </label>
          <input
            id="form-event-date"
            type="date"
            className="form-input"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            aria-invalid={Boolean(errors.eventDate)}
            aria-describedby={errors.eventDate ? 'form-event-date-error' : undefined}
          />
          {errors.eventDate && (
            <span id="form-event-date-error" className="form-error" role="alert">
              {errors.eventDate}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="form-event-time" className="form-label">
            Event Time (HH:mm 24h)
          </label>
          <input
            id="form-event-time"
            type="time"
            className="form-input"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            aria-invalid={Boolean(errors.eventTime)}
            aria-describedby={errors.eventTime ? 'form-event-time-error' : undefined}
          />
          {errors.eventTime && (
            <span id="form-event-time-error" className="form-error" role="alert">
              {errors.eventTime}
            </span>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="form-deadline-date" className="form-label">
            Deadline Date (YYYY-MM-DD)
          </label>
          <input
            id="form-deadline-date"
            type="date"
            className="form-input"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            aria-invalid={Boolean(errors.deadlineDate)}
            aria-describedby={errors.deadlineDate ? 'form-deadline-date-error' : undefined}
          />
          {errors.deadlineDate && (
            <span id="form-deadline-date-error" className="form-error" role="alert">
              {errors.deadlineDate}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="form-deadline-time" className="form-label">
            Deadline Time (HH:mm 24h)
          </label>
          <input
            id="form-deadline-time"
            type="time"
            className="form-input"
            value={deadlineTime}
            onChange={(e) => setDeadlineTime(e.target.value)}
            aria-invalid={Boolean(errors.deadlineTime)}
            aria-describedby={errors.deadlineTime ? 'form-deadline-time-error' : undefined}
          />
          {errors.deadlineTime && (
            <span id="form-deadline-time-error" className="form-error" role="alert">
              {errors.deadlineTime}
            </span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="form-description" className="form-label">
          Description
        </label>
        <textarea
          id="form-description"
          className="form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          placeholder="Detailed instructions, links, or notes..."
        />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>
          {description.length} / 1000 characters
        </span>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm">
          {isEditing ? 'Save Changes' : 'Save Notice'}
        </button>
      </div>
    </form>
  );
};
