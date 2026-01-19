/**
 * Juno Jobs - UX Enhancements JavaScript
 * Interactive features for improved user experience
 */

(function() {
  'use strict';

  // ============================================
  // PHASE 1: Basic Interactions
  // ============================================

  /**
   * Back to Top Button
   */
  function initBackToTop() {
    // Create button if it doesn't exist
    let backToTopBtn = document.getElementById('back-to-top');
    if (!backToTopBtn) {
      backToTopBtn = document.createElement('button');
      backToTopBtn.id = 'back-to-top';
      backToTopBtn.setAttribute('aria-label', 'Back to top');
      backToTopBtn.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>';
      document.body.appendChild(backToTopBtn);
    }

    // Show/hide based on scroll position
    function toggleBackToTop() {
      if (window.scrollY > 500) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }

    // Scroll to top on click
    backToTopBtn.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    // Listen to scroll events (throttled)
    let scrollTimeout;
    window.addEventListener('scroll', function() {
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
      }
      scrollTimeout = window.requestAnimationFrame(function() {
        toggleBackToTop();
      });
    });

    // Initial check
    toggleBackToTop();
  }

  /**
   * Loading States for Links and Buttons
   */
  function initLoadingStates() {
    // Add loading state to pagination links
    document.querySelectorAll('.pagination a, .pagination button').forEach(function(elem) {
      elem.addEventListener('click', function(e) {
        if (!elem.classList.contains('active')) {
          elem.classList.add('loading');
        }
      });
    });

    // Add loading state to search forms
    document.querySelectorAll('form[action*="search"]').forEach(function(form) {
      form.addEventListener('submit', function() {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.classList.add('loading');
          submitBtn.disabled = true;
        }
      });
    });
  }

  /**
   * Keyboard Shortcuts
   */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // "/" key - Focus search
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        const searchInput = document.querySelector('input[name="q"], input[type="search"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Arrow keys for pagination
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (e.key === 'ArrowLeft') {
          const prevBtn = document.querySelector('.pagination a[rel="prev"], .pagination a:has(svg[data-direction="left"])');
          if (prevBtn) prevBtn.click();
        }
        if (e.key === 'ArrowRight') {
          const nextBtn = document.querySelector('.pagination a[rel="next"], .pagination a:has(svg[data-direction="right"])');
          if (nextBtn) nextBtn.click();
        }
      }

      // Escape key - Close modals
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open, [role="dialog"].open').forEach(function(modal) {
          modal.classList.remove('open');
        });
      }
    });
  }

  // ============================================
  // PHASE 2: Job Card Interactions
  // ============================================

  /**
   * Save Job Functionality
   */
  function initSaveJobs() {
    // Get saved jobs from localStorage
    function getSavedJobs() {
      const saved = localStorage.getItem('savedJobs');
      return saved ? JSON.parse(saved) : [];
    }

    // Save job to localStorage
    function saveJob(jobId) {
      const saved = getSavedJobs();
      if (!saved.includes(jobId)) {
        saved.push(jobId);
        localStorage.setItem('savedJobs', JSON.stringify(saved));
        return true;
      }
      return false;
    }

    // Remove job from localStorage
    function unsaveJob(jobId) {
      let saved = getSavedJobs();
      saved = saved.filter(id => id !== jobId);
      localStorage.setItem('savedJobs', JSON.stringify(saved));
    }

    // Check if job is saved
    function isJobSaved(jobId) {
      return getSavedJobs().includes(jobId);
    }

    // Initialize save buttons
    document.querySelectorAll('[data-save-job]').forEach(function(btn) {
      const jobId = btn.getAttribute('data-job-id');

      // Set initial state
      if (isJobSaved(jobId)) {
        btn.classList.add('active');
        btn.setAttribute('aria-label', 'Unsave job');
      }

      // Click handler
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (isJobSaved(jobId)) {
          unsaveJob(jobId);
          btn.classList.remove('active');
          btn.setAttribute('aria-label', 'Save job');
          showToast('Job removed from saved jobs', 'info');
        } else {
          if (saveJob(jobId)) {
            btn.classList.add('active', 'save-success');
            btn.setAttribute('aria-label', 'Unsave job');
            showToast('Job saved! ✓', 'success');
            setTimeout(function() {
              btn.classList.remove('save-success');
            }, 500);
          }
        }
      });
    });

    // Update saved jobs counter in header
    function updateSavedCounter() {
      const counter = document.querySelector('[data-saved-count]');
      if (counter) {
        const count = getSavedJobs().length;
        counter.textContent = count;
        counter.style.display = count > 0 ? 'flex' : 'none';
      }
    }
    updateSavedCounter();
  }

  /**
   * Share Job Functionality
   */
  function initShareJobs() {
    document.querySelectorAll('[data-share-job]').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();

        const jobTitle = btn.getAttribute('data-job-title') || 'Check out this job';
        const jobUrl = btn.getAttribute('data-job-url') || window.location.href;

        // Use native share API if available
        if (navigator.share) {
          try {
            await navigator.share({
              title: jobTitle,
              text: `${jobTitle} on Juno Jobs`,
              url: jobUrl
            });
            showToast('Shared successfully!', 'success');
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error('Error sharing:', err);
            }
          }
        } else {
          // Fallback: copy to clipboard
          try {
            await navigator.clipboard.writeText(jobUrl);
            showToast('Link copied to clipboard!', 'success');
          } catch (err) {
            console.error('Error copying to clipboard:', err);
            showToast('Could not copy link', 'error');
          }
        }
      });
    });
  }

  /**
   * Toast Notification System
   */
  function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    // Add icon based on type
    let icon = '';
    if (type === 'success') {
      icon = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>';
    } else if (type === 'error') {
      icon = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>';
    } else {
      icon = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>';
    }

    toast.innerHTML = icon + '<span>' + message + '</span>';
    document.body.appendChild(toast);

    // Show toast
    setTimeout(function() {
      toast.classList.add('show');
    }, 100);

    // Hide and remove toast
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Make showToast globally available
  window.showToast = showToast;

  // ============================================
  // PHASE 3: Advanced Features
  // ============================================

  /**
   * Scroll Reveal Animations
   */
  function initScrollReveal() {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            // Optionally unobserve after revealing
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });

      // Observe elements
      document.querySelectorAll('.trust-badge, .category-card, .job-card').forEach(function(elem) {
        observer.observe(elem);
      });
    }
  }

  /**
   * Dynamic Placeholder for Search
   */
  function initDynamicPlaceholder() {
    const searchInput = document.querySelector('input[name="q"][type="text"]');
    if (!searchInput || searchInput.value) return;

    const placeholders = [
      'Search for Python Developer in San Francisco...',
      'Try: Senior React Engineer Remote',
      'Find: Machine Learning roles at startups',
      'Example: Full Stack Developer New York',
      'Search: DevOps Engineer AWS experience'
    ];

    let currentIndex = 0;

    function rotatePlaceholder() {
      searchInput.setAttribute('placeholder', placeholders[currentIndex]);
      currentIndex = (currentIndex + 1) % placeholders.length;
    }

    // Rotate every 3 seconds
    rotatePlaceholder();
    setInterval(rotatePlaceholder, 3000);
  }

  /**
   * Preserve Scroll Position
   */
  function initScrollPreservation() {
    // Save scroll position before leaving page
    window.addEventListener('beforeunload', function() {
      sessionStorage.setItem('scrollPosition', window.scrollY);
    });

    // Restore scroll position on page load
    window.addEventListener('load', function() {
      const scrollPos = sessionStorage.getItem('scrollPosition');
      if (scrollPos) {
        window.scrollTo(0, parseInt(scrollPos));
        sessionStorage.removeItem('scrollPosition');
      }
    });
  }

  /**
   * Filter Counters (if filter data is available)
   */
  function initFilterCounters() {
    // This would require backend support to provide counts
    // Placeholder for future implementation
    document.querySelectorAll('[data-filter-option]').forEach(function(option) {
      const count = option.getAttribute('data-filter-count');
      if (count) {
        const countElem = document.createElement('span');
        countElem.className = 'filter-count';
        countElem.textContent = count;
        option.appendChild(countElem);
      }
    });
  }

  /**
   * Enhanced Search Bar Focus
   */
  function initSearchBarEnhancements() {
    const searchBars = document.querySelectorAll('.search-bar-enhanced, form[action*="search"]');
    searchBars.forEach(function(searchBar) {
      const input = searchBar.querySelector('input[type="text"], input[type="search"]');
      if (input) {
        input.addEventListener('focus', function() {
          searchBar.classList.add('focused');
        });
        input.addEventListener('blur', function() {
          searchBar.classList.remove('focused');
        });
      }
    });
  }

  // ============================================
  // PHASE 4: Performance & Polish
  // ============================================

  /**
   * Lazy Load Images
   */
  function initLazyLoading() {
    if ('loading' in HTMLImageElement.prototype) {
      // Native lazy loading supported
      document.querySelectorAll('img[data-src]').forEach(function(img) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    } else {
      // Fallback to Intersection Observer
      const imageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(function(img) {
        imageObserver.observe(img);
      });
    }
  }

  /**
   * Preload Links on Hover
   */
  function initLinkPreloading() {
    if ('requestIdleCallback' in window) {
      document.querySelectorAll('a[href^="/"]').forEach(function(link) {
        link.addEventListener('mouseenter', function() {
          requestIdleCallback(function() {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'prefetch';
            preloadLink.href = link.href;
            document.head.appendChild(preloadLink);
          });
        }, { once: true });
      });
    }
  }

  /**
   * Analytics Helper (placeholder)
   */
  function trackEvent(eventName, eventData) {
    // Placeholder for analytics tracking
    if (window.gtag) {
      window.gtag('event', eventName, eventData);
    }
    console.log('Track event:', eventName, eventData);
  }

  window.trackEvent = trackEvent;

  // ============================================
  // Initialize All Features
  // ============================================

  function init() {
    // Check if DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Phase 1: Basic interactions
    initBackToTop();
    initLoadingStates();
    initKeyboardShortcuts();

    // Phase 2: Job card interactions
    initSaveJobs();
    initShareJobs();

    // Phase 3: Advanced features
    initScrollReveal();
    initDynamicPlaceholder();
    initScrollPreservation();
    initFilterCounters();
    initSearchBarEnhancements();

    // Phase 4: Performance & polish
    initLazyLoading();
    initLinkPreloading();

    console.log('Juno Jobs UX Enhancements loaded successfully!');
  }

  // Start initialization
  init();
})();
