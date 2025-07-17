// Ensure DOMContentLoaded is handled once for all new scripts
document.addEventListener('DOMContentLoaded', function() {
    // Smooth section transitions and staggered animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                // Stagger animations for child elements within the section
                const animateElements = entry.target.querySelectorAll('.animate-in');
                animateElements.forEach((el, i) => {
                    // Only run animation if it's currently paused (i.e., not already animated)
                    if (el.style.animationPlayState === 'paused') {
                        setTimeout(() => {
                            el.style.animationPlayState = 'running';
                        }, i * 100); // Stagger by 100ms
                    }
                });
                // Once section is visible, we can stop observing it for basic animation
                // sectionObserver.unobserve(entry.target); // Re-enable if you only want animations once
            }
        });
    }, observerOptions);
    
    // Observe all sections (or specific ones with .animate-in if preferred)
    document.querySelectorAll('section').forEach(section => {
        sectionObserver.observe(section);
    });
    
    // Parallax effect for hero section (optional, if you want background to scroll slower)
    let tickingParallax = false;
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');
        if (hero) {
            // Adjust the 0.3 factor for more or less parallax effect
            hero.style.backgroundPositionY = `${scrolled * 0.3}px`;
        }
        tickingParallax = false;
    }
    
    window.addEventListener('scroll', function() {
        if (!tickingParallax) {
            window.requestAnimationFrame(updateParallax);
            tickingParallax = true;
        }
    });
    
    // Enhanced CTA button click feedback (Ripple Effect)
    document.querySelectorAll('.cta-button').forEach(button => {
        // Ensure the button has position: relative and overflow: hidden in CSS for ripple to work
        button.style.position = 'relative';
        button.style.overflow = 'hidden';

        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            this.appendChild(ripple);
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            setTimeout(() => ripple.remove(), 600); // Remove ripple after animation
        });
    });

    // Dynamically add ripple effect styles to head
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5); /* White ripple */
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none; /* Ensure clicks pass through */
        }
        
        @keyframes ripple-animation {
            to {
                transform: scale(4); /* Expand the ripple */
                opacity: 0; /* Fade out */
            }
        }
    `;
    document.head.appendChild(rippleStyle);
});