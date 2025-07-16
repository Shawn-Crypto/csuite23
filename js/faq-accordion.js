/**
 * FAQ Accordion Functionality
 * Feature ID: FEAT-010
 * Created: January 2025
 * Purpose: Interactive FAQ section with smooth accordion animations
 */

/**
 * Toggle FAQ item open/closed state
 * @param {HTMLElement} questionElement - The clicked FAQ question button
 */
function toggleFAQ(questionElement) {
    // Get the parent FAQ item container
    const faqItem = questionElement.closest('.faq-item');
    
    // Check if this item is currently active
    const isCurrentlyActive = faqItem.classList.contains('active');
    
    // Close all other FAQ items (accordion behavior - only one open at a time)
    const allFaqItems = document.querySelectorAll('.faq-item');
    allFaqItems.forEach(item => {
        if (item !== faqItem) {
            item.classList.remove('active');
            const answer = item.querySelector('.faq-answer');
            if (answer) {
                answer.style.maxHeight = '0';
            }
        }
    });
    
    // Toggle the current item
    if (isCurrentlyActive) {
        // Close the current item
        faqItem.classList.remove('active');
        const answer = faqItem.querySelector('.faq-answer');
        if (answer) {
            answer.style.maxHeight = '0';
        }
    } else {
        // Open the current item
        faqItem.classList.add('active');
        const answer = faqItem.querySelector('.faq-answer');
        if (answer) {
            // Calculate the height needed for the content
            answer.style.maxHeight = answer.scrollHeight + 'px';
        }
    }
}

/**
 * Initialize FAQ accordion functionality
 * Sets up event listeners and initial states
 */
function initializeFAQ() {
    // Get all FAQ questions
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    // Add click event listeners to all FAQ questions
    faqQuestions.forEach(question => {
        // Remove any existing onclick attributes to prevent conflicts
        question.removeAttribute('onclick');
        
        // Add modern event listener
        question.addEventListener('click', function(e) {
            e.preventDefault();
            toggleFAQ(this);
        });
        
        // Add keyboard accessibility
        question.addEventListener('keydown', function(e) {
            // Handle Enter and Space key presses
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFAQ(this);
            }
        });
        
        // Ensure proper ARIA attributes for accessibility
        question.setAttribute('aria-expanded', 'false');
        question.setAttribute('tabindex', '0');
        
        // Find the associated answer and set up ARIA relationship
        const faqItem = question.closest('.faq-item');
        const answer = faqItem.querySelector('.faq-answer');
        if (answer) {
            const answerId = 'faq-answer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            answer.setAttribute('id', answerId);
            question.setAttribute('aria-controls', answerId);
            
            // Ensure answer is initially hidden
            answer.style.maxHeight = '0';
            answer.style.overflow = 'hidden';
        }
    });
    
    // Track FAQ interactions for analytics
    faqQuestions.forEach((question, index) => {
        question.addEventListener('click', function() {
            // Push FAQ interaction event to dataLayer for GTM
            if (typeof window.dataLayer !== 'undefined') {
                window.dataLayer.push({
                    'event': 'faq_interaction',
                    'faq_question': question.textContent.trim(),
                    'faq_index': index + 1,
                    'section': 'faq'
                });
            }
        });
    });
}

/**
 * Handle window resize events to recalculate FAQ answer heights
 */
function handleFAQResize() {
    const activeFaqItems = document.querySelectorAll('.faq-item.active');
    
    activeFaqItems.forEach(item => {
        const answer = item.querySelector('.faq-answer');
        if (answer) {
            // Recalculate height after resize
            answer.style.maxHeight = answer.scrollHeight + 'px';
        }
    });
}

/**
 * FAQ scroll-to functionality
 * Allows linking directly to specific FAQ items
 */
function initializeFAQLinking() {
    // Check if URL contains FAQ hash
    const hash = window.location.hash;
    if (hash && hash.startsWith('#faq-')) {
        const faqIndex = parseInt(hash.replace('#faq-', ''));
        if (!isNaN(faqIndex)) {
            setTimeout(() => {
                const faqItems = document.querySelectorAll('.faq-item');
                if (faqItems[faqIndex - 1]) {
                    const question = faqItems[faqIndex - 1].querySelector('.faq-question');
                    if (question) {
                        // Open the FAQ item
                        toggleFAQ(question);
                        // Scroll to the FAQ section
                        question.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 500); // Delay to ensure page is loaded
        }
    }
}

/**
 * Add FAQ item IDs for direct linking
 */
function addFAQIds() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach((item, index) => {
        item.setAttribute('id', `faq-item-${index + 1}`);
    });
}

/**
 * Smooth scroll behavior for FAQ navigation
 */
function initializeFAQNavigation() {
    // Add smooth scrolling for any FAQ links
    const faqLinks = document.querySelectorAll('a[href^="#faq"]');
    faqLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * Initialize all FAQ functionality when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    // Wait a brief moment to ensure all elements are rendered
    setTimeout(() => {
        initializeFAQ();
        addFAQIds();
        initializeFAQLinking();
        initializeFAQNavigation();
        
        // Add resize listener for responsive height adjustments
        window.addEventListener('resize', handleFAQResize);
        
        console.log('FAQ accordion functionality initialized successfully');
    }, 100);
});

/**
 * Fallback initialization if DOMContentLoaded has already fired
 */
if (document.readyState === 'loading') {
    // DOMContentLoaded has not fired yet, wait for it
    // (handled above)
} else {
    // DOMContentLoaded has already fired, initialize immediately
    setTimeout(() => {
        initializeFAQ();
        addFAQIds();
        initializeFAQLinking();
        initializeFAQNavigation();
        window.addEventListener('resize', handleFAQResize);
        console.log('FAQ accordion functionality initialized successfully (fallback)');
    }, 100);
}

/**
 * Export functions for potential external use
 * (if using module system in the future)
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        toggleFAQ,
        initializeFAQ,
        handleFAQResize
    };
}