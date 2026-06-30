'use strict';

const BaseAdapter = require('./BaseAdapter');
const config = require('../../common/config');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// ReviewTreasuresAdapter — Adapter for ReviewTreasures platform integration
// ---------------------------------------------------------------------------

const MOCK_REVIEWS = [
  {
    form_data_id: 132,
    form_data_unique_id: "CUSRW000128",
    form_point: { "point_out_off": 10, "point": 10 },
    form_rating: 10,
    created_at: "2026-06-26 12:57:46",
    form_data: [
      JSON.stringify([
        {
          type: "text",
          required: true,
          label: "Enter Your Name",
          autocomplete: "Off",
          placeholder: "",
          form_element_id: "1",
          className: "form-control input-sm",
          name: "Name",
          subtype: "text",
          other: "Name",
          "data-parsley-required-message": "Name Required",
          userData: ["Nandan P"]
        },
        {
          type: "text",
          required: true,
          label: "Enter Your Email",
          autocomplete: "Off",
          placeholder: "",
          form_element_id: "6",
          className: "form-control input-sm",
          name: "Email",
          subtype: "email",
          other: "",
          "data-parsley-required-message": "Email Required",
          userData: ["nandanp@scribbleandconnect.com"]
        },
        {
          type: "text",
          required: true,
          label: "Enter Your Phone",
          autocomplete: "Off",
          placeholder: "",
          form_element_id: "7",
          className: "form-control input-sm",
          name: "Phone",
          subtype: "tel",
          other: "Mobile",
          maxlength: "8",
          pattern: "[0-9]{8}",
          "data-parsley-required-message": "Phone Number Required",
          userData: ["98765432"]
        }
      ]),
      JSON.stringify([
        {
          type: "radio-group",
          required: true,
          label: "Question 1",
          form_element_id: "13",
          name: "Radio Group",
          "data-parsley-required-message": "Radio Group Required",
          other: "",
          className: "normal",
          radio_type: "normal",
          values: [
            { label: "Answer 1", value: "Answer 1", selected: false, point: "10" },
            { label: "Answer 2", value: "Answer 2", selected: false, point: "5" },
            { label: "Answer 2", value: "Answer 2", selected: false, point: "2" }
          ],
          userData: ["Answer 1"]
        }
      ])
    ]
  },
  {
    form_data_id: 123,
    form_data_unique_id: "CUSRW000119",
    form_point: { "point_out_off": 60, "point": 12 },
    form_rating: 1,
    created_at: "2026-06-26 13:20:00",
    form_data: [
      JSON.stringify([
        {
          type: "text",
          required: true,
          label: "Enter Your Name",
          name: "Name",
          subtype: "text",
          userData: ["John Doe"]
        },
        {
          type: "text",
          required: true,
          label: "Enter Your Email",
          name: "Email",
          subtype: "email",
          userData: ["johndoe@example.com"]
        }
      ]),
      JSON.stringify([
        {
          type: "radio-group",
          label: "How was our service?",
          name: "service_rating",
          userData: ["Poor support and delayed responses"]
        },
        {
          type: "textarea",
          label: "Explain the issue",
          name: "issue_details",
          userData: ["The consultant did not answer my email for three days and when they did, they charged me double the agreed amount."]
        }
      ])
    ]
  }
];

class ReviewTreasuresAdapter extends BaseAdapter {
  constructor() {
    super('reviewtreasures');
  }

  /**
   * Fetch reviews from the Review Treasures platform.
   * Falls back to a mock dataset if API URL is not configured.
   *
   * @param {Object} [options]
   * @returns {Promise<import('./BaseAdapter').NormalizedReview[]>}
   */
  async fetchReviews(options = {}) {
    const { apiUrl, apiKey } = config.reviewAgent.reviewtreasures || {};

    if (!apiUrl) {
      logger.info('ReviewTreasures API URL is not configured. Returning mock reviews.');
      return MOCK_REVIEWS.map(review => this._normalize(review));
    }

    logger.info('Fetching reviews from ReviewTreasures API', { apiUrl });

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${apiUrl}/reviews`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`ReviewTreasures API returned status ${response.status}`);
      }

      const data = await response.json();
      const reviews = Array.isArray(data) ? data : (data?.reviews || []);

      logger.info(`Fetched ${reviews.length} reviews from ReviewTreasures API`);
      return reviews.map(review => this._normalize(review));
    } catch (error) {
      logger.error('Failed to fetch reviews from ReviewTreasures API', { error: error.message });
      throw error;
    }
  }

  /**
   * Post a reply to a Review Treasures review.
   * Falls back to success log if API URL is not configured.
   *
   * @param {string} reviewId
   * @param {string} replyText
   * @returns {Promise<boolean>}
   */
  async postReply(reviewId, replyText) {
    const { apiUrl, apiKey } = config.reviewAgent.reviewtreasures || {};

    if (!apiUrl) {
      logger.info('ReviewTreasures API URL is not configured. Mocking reply success.', { reviewId, replyText });
      return true;
    }

    logger.info('Posting reply to ReviewTreasures API', { reviewId });

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${apiUrl}/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ replyText }),
      });

      if (!response.ok) {
        throw new Error(`ReviewTreasures API reply returned status ${response.status}`);
      }

      logger.info('Reply posted successfully to ReviewTreasures API', { reviewId });
      return true;
    } catch (error) {
      logger.error('Failed to post reply to ReviewTreasures API', { reviewId, error: error.message });
      throw error;
    }
  }

  /**
   * Normalize a Review Treasures review object into the standard format.
   * @private
   * @param {Object} rawReview — Raw review object.
   * @returns {import('./BaseAdapter').NormalizedReview}
   */
  _normalize(rawReview) {
    const {
      form_data_id,
      form_data_unique_id,
      form_rating,
      form_point,
      form_data,
      created_at,
    } = rawReview;

    const reviewId = form_data_unique_id || String(form_data_id);

    // 1. Parse Rating (mapping to 1-5 scale)
    let rating = Number(form_rating);
    // If form_rating is 0, falsy, or not a number, fallback to form_point calculation
    if (!rating && form_point) {
      let ptObj = {};
      if (typeof form_point === 'string') {
        try {
          ptObj = JSON.parse(form_point);
        } catch (e) {
          logger.error('Failed to parse form_point string', { form_point, error: e.message });
        }
      } else if (typeof form_point === 'object') {
        ptObj = form_point;
      }
      const maxPt = Number(ptObj.point_out_off);
      const pt = Number(ptObj.point);
      if (maxPt > 0) {
        rating = Math.round((pt / maxPt) * 5);
      }
    }
    // Scale rating down if it's out of 10
    if (rating > 5) {
      rating = Math.round(rating / 2);
    }
    // Ensure rating is between 1 and 5
    rating = Math.max(1, Math.min(5, rating || 1));

    // 2. Parse form_data to extract reviewer details and QA comments
    let authorName = 'Anonymous';
    let authorEmail = '';
    let authorPhone = '';
    const qaPairs = [];

    if (Array.isArray(form_data)) {
      for (const chunk of form_data) {
        let fields = [];
        if (typeof chunk === 'string') {
          try {
            fields = JSON.parse(chunk);
          } catch (e) {
            logger.error('Failed to parse form_data chunk string', { chunk, error: e.message });
            continue;
          }
        } else if (Array.isArray(chunk)) {
          fields = chunk;
        }

        for (const field of fields) {
          if (!field || typeof field !== 'object') continue;

          const label = (field.label || '').trim();
          const name = (field.name || '').trim();
          const other = (field.other || '').trim();
          const subtype = (field.subtype || '').trim();
          const userData = Array.isArray(field.userData) ? field.userData : [];
          const value = userData.join(', ').trim();

          if (!value) continue;

          // Check if this field represents user details
          const isNameField = name.toLowerCase() === 'name' ||
                              other.toLowerCase() === 'name' ||
                              label.toLowerCase().includes('your name') ||
                              label.toLowerCase() === 'name';

          const isEmailField = subtype === 'email' ||
                               label.toLowerCase().includes('email') ||
                               name.toLowerCase() === 'email';

          const isPhoneField = subtype === 'tel' ||
                               other.toLowerCase() === 'mobile' ||
                               label.toLowerCase().includes('phone') ||
                               label.toLowerCase().includes('mobile') ||
                               name.toLowerCase() === 'phone';

          if (isNameField) {
            authorName = value;
          } else if (isEmailField) {
            authorEmail = value;
          } else if (isPhoneField) {
            authorPhone = value;
          } else {
            // It's a QA field
            qaPairs.push(`${label}: ${value}`);
          }
        }
      }
    }

    // Format the comment nicely to contain contact details followed by the Q&A responses
    const contactInfo = [];
    if (authorEmail) contactInfo.push(`Email: ${authorEmail}`);
    if (authorPhone) contactInfo.push(`Phone: ${authorPhone}`);

    let comment = '';
    if (contactInfo.length > 0) {
      comment += contactInfo.join('\n') + '\n\n';
    }
    comment += qaPairs.join('\n');

    return {
      reviewId,
      authorName,
      rating,
      comment: comment.trim(),
      createdAt: created_at ? new Date(created_at) : new Date(),
    };
  }
}

module.exports = ReviewTreasuresAdapter;
