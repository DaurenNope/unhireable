#!/bin/bash
# Visible Demo - Opens Chrome and fills a form you can SEE

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║      👁️  VISIBLE BROWSER DEMO  👁️                                 ║"
echo "║                                                                  ║"
echo "║   This will open YOUR Chrome and fill a job application         ║"
echo "║   using JavaScript injection - you'll SEE it happen!            ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Fresh Spotify job URL
JOB_URL="https://jobs.lever.co/spotify/a8e55f8b-10d2-4201-863e-b9d5de3a5856/apply"

echo "🎯 Target: Spotify Software Engineer"
echo "🔗 URL: $JOB_URL"
echo ""
echo "Opening Chrome in 3 seconds..."
sleep 3

# Open Chrome to the job application page
open -a "Google Chrome" "$JOB_URL"

echo ""
echo "✅ Chrome should now be open to the Spotify job application!"
echo ""
echo "Now wait 5 seconds for page to load, then we'll fill the form..."
sleep 5

# Use osascript to inject JavaScript into Chrome to fill the form
osascript <<'APPLESCRIPT'
tell application "Google Chrome"
    activate
    tell active tab of front window
        execute javascript "
            // JobEZ Automation Demo - Filling form fields
            console.log('🚀 JobEZ Form Fill Starting...');
            
            // Helper to fill a field with animation
            function fillField(selector, value, delay) {
                return new Promise(resolve => {
                    setTimeout(() => {
                        const el = document.querySelector(selector);
                        if (el) {
                            el.focus();
                            el.value = '';
                            // Type character by character
                            let i = 0;
                            const typeChar = () => {
                                if (i < value.length) {
                                    el.value += value[i];
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                    i++;
                                    setTimeout(typeChar, 30);
                                } else {
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                    console.log('✅ Filled: ' + selector);
                                    resolve();
                                }
                            };
                            typeChar();
                        } else {
                            console.log('⚠️ Field not found: ' + selector);
                            resolve();
                        }
                    }, delay);
                });
            }
            
            // Fill the form fields one by one with visible typing
            (async () => {
                await fillField('input[name=\"name\"]', 'Alex Johnson', 500);
                await fillField('input[name=\"email\"]', 'alex.johnson@email.com', 500);
                await fillField('input[name=\"phone\"]', '+1-555-123-4567', 500);
                await fillField('input[name=\"org\"]', 'Current Company Inc.', 500);
                await fillField('input[name=\"urls[LinkedIn]\"]', 'https://linkedin.com/in/alexjohnson', 500);
                await fillField('input[name=\"urls[GitHub]\"]', 'https://github.com/alexjohnson', 500);
                await fillField('input[name=\"urls[Portfolio]\"]', 'https://alexjohnson.dev', 500);
                
                console.log('');
                console.log('✅ FORM FILL COMPLETE!');
                console.log('📝 Review the filled fields above.');
                console.log('⚠️ Submit was NOT clicked (safe demo).');
                
                // Highlight the submit button
                const submitBtn = document.querySelector('button[type=\"submit\"]');
                if (submitBtn) {
                    submitBtn.style.border = '3px solid red';
                    submitBtn.style.boxShadow = '0 0 10px red';
                }
            })();
        "
    end tell
end tell
APPLESCRIPT

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "✅ FORM FILL COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Look at Chrome - the form fields should be filled with:"
echo "   Name:     Alex Johnson"
echo "   Email:    alex.johnson@email.com"
echo "   Phone:    +1-555-123-4567"
echo "   LinkedIn: https://linkedin.com/in/alexjohnson"
echo "   GitHub:   https://github.com/alexjohnson"
echo ""
echo "The Submit button is highlighted in RED but NOT clicked."
echo ""
echo "This is exactly what JobEZ automation does - but it can also:"
echo "   • Upload your resume PDF"
echo "   • Attach a generated cover letter"
echo "   • Click Submit automatically (in Autopilot mode)"
echo ""
