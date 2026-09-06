#!/usr/bin/env node

/**
 * Simple local webhook receiver for testing the Uptime Kuma webhook fix
 * 
 * Usage:
 *   node test-webhook-server.js
 * 
 * Then in Uptime Kuma, use webhook URL: http://localhost:3002/webhook
 */

const express = require('express');
const app = express();

// Parse JSON bodies
app.use(express.json());

// Also accept text/plain (in case webhook sends as string)
app.use(express.text({ type: 'text/*' }));

// Accept any content type as text for debugging
app.use(express.raw({ type: '*/*', limit: '10mb' }));

app.post('/webhook', (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log('📨 Webhook Received at', new Date().toISOString());
    console.log('='.repeat(80));
    
    console.log('\n📋 Headers:');
    Object.keys(req.headers).forEach(key => {
        console.log(`  ${key}: ${req.headers[key]}`);
    });
    
    console.log('\n📦 Body:');
    console.log(`  Type: ${typeof req.body}`);
    console.log(`  Content-Type: ${req.headers['content-type']}`);
    
    // If body is a buffer, convert to string
    let bodyContent = req.body;
    if (Buffer.isBuffer(req.body)) {
        bodyContent = req.body.toString('utf-8');
        console.log(`  Converted from Buffer to string`);
    }
    
    console.log(`\n📄 Raw Content:`);
    console.log('─'.repeat(80));
    if (typeof bodyContent === 'string') {
        console.log(bodyContent);
    } else {
        console.log(JSON.stringify(bodyContent, null, 2));
    }
    console.log('─'.repeat(80));
    
    // Try to parse as JSON
    if (typeof bodyContent === 'string') {
        console.log('\n🔍 JSON Validation:');
        try {
            const parsed = JSON.parse(bodyContent);
            console.log('  ✅ VALID JSON!');
            console.log('\n📊 Parsed Object:');
            console.log(JSON.stringify(parsed, null, 2));
            
            // Check for common fields
            if (parsed.msg || parsed.message) {
                const msgField = parsed.msg || parsed.message;
                console.log('\n💬 Message Analysis:');
                console.log(`  Length: ${msgField.length} characters`);
                console.log(`  Contains newlines: ${msgField.includes('\n') ? 'YES' : 'NO'}`);
                console.log(`  Contains quotes: ${msgField.includes('"') ? 'YES' : 'NO'}`);
                if (msgField.includes('\n')) {
                    console.log(`  Newline count: ${(msgField.match(/\n/g) || []).length}`);
                }
            }
            
        } catch (e) {
            console.log('  ❌ INVALID JSON!');
            console.log(`  Error: ${e.message}`);
            console.log(`\n  This is the bug! The payload should be valid JSON.`);
            console.log(`  Tip: Use {{msg | json_escape}} in your webhook template.`);
        }
    } else if (typeof bodyContent === 'object') {
        console.log('\n✅ Object received (Express auto-parsed as JSON)');
        console.log('  This means the Content-Type was set correctly.');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✓ Response sent: 200 OK');
    console.log('='.repeat(80) + '\n');
    
    // Send success response
    res.status(200).json({ 
        success: true,
        received: true,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Webhook Test Server</title>
                <style>
                    body {
                        font-family: monospace;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    .box {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    code {
                        background: #eee;
                        padding: 2px 6px;
                        border-radius: 3px;
                    }
                    h1 { color: #5cdd8b; }
                    .success { color: #5cdd8b; }
                    .warning { color: #f39c12; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>✓ Webhook Test Server Running</h1>
                    <p class="success">Server is ready to receive webhooks!</p>
                    
                    <h3>Webhook Endpoint:</h3>
                    <code>http://localhost:3002/webhook</code>
                    
                    <h3>How to use:</h3>
                    <ol>
                        <li>In Uptime Kuma, go to Settings → Notifications</li>
                        <li>Create a new Webhook notification</li>
                        <li>Use the URL above</li>
                        <li>Set HTTP Method to POST</li>
                        <li>For Content Type, use "Custom"</li>
                        <li>Use a custom body with json_escape filter:
                            <pre>{
  "message": "{{msg | json_escape}}",
  "monitor": "{{monitorJSON.name | json_escape}}",
  "status": {{heartbeatJSON.status}}
}</pre>
                        </li>
                        <li>Watch the terminal where this server is running</li>
                    </ol>
                    
                    <h3>Test with curl:</h3>
                    <code>curl -X POST http://localhost:3002/webhook -H "Content-Type: application/json" -d '{"test": "data\\nwith\\nnewlines"}'</code>
                    
                    <p class="warning">Check the terminal output for detailed analysis!</p>
                </div>
            </body>
        </html>
    `);
});

// Start server
const PORT = 3002;
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Webhook Test Server Started');
    console.log('='.repeat(80));
    console.log(`\n📍 Listening on: http://localhost:${PORT}`);
    console.log(`📍 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(`📍 Web UI: http://localhost:${PORT}/`);
    console.log('\n💡 Configure this URL in Uptime Kuma webhook settings');
    console.log('💡 Watch this terminal for incoming webhook requests\n');
    console.log('Press Ctrl+C to stop\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down webhook server...\n');
    process.exit(0);
});
