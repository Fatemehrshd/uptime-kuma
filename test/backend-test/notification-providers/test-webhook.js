const { describe, test } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");
const Webhook = require("../../../server/notification-providers/webhook");

describe("Webhook Notification Provider", () => {
    
    describe("JSON Payload Handling", () => {
        
        test("should handle newlines in message correctly", async () => {
            const webhook = new Webhook();
            
            // Mock notification config - DEFAULT MODE (not form-data, not custom)
            const notification = {
                webhookURL: "https://example.com/webhook",
                httpMethod: "post",
                // No webhookContentType means default JSON object mode
            };
            
            // Message with newlines (common in PING monitor down messages)
            // This is exactly the kind of message that causes issue #3778
            const msg = "ping: cannot resolve example.com: Unknown host\nping: cannot resolve example.com: Unknown host";
            
            // Mock monitor and heartbeat data
            const monitorJSON = {
                id: 1,
                name: "Test Monitor",
                type: "ping",
                hostname: "192.168.1.1"
            };
            
            const heartbeatJSON = {
                status: 0, // DOWN
                msg: "ping: cannot resolve example.com: Unknown host\nping: cannot resolve example.com: Unknown host",
                time: "2023-09-20T14:51:51.000Z",
                timezone: "UTC",
                localDateTime: "2023-09-20 14:51:51"
            };
            
            // Mock axios to capture the actual HTTP request
            let capturedData = null;
            let capturedConfig = null;
            const originalPost = axios.post;
            axios.post = async (url, data, config) => {
                capturedData = data;
                capturedConfig = config;
                
                // Simulate what axios actually does: stringify the object
                const jsonString = JSON.stringify(data);
                
                // This should not throw - if it does, we have the bug
                assert.doesNotThrow(() => {
                    JSON.parse(jsonString);
                }, "Axios should be able to serialize and parse the payload");
                
                return { data: { success: true }, status: 200 };
            };
            
            try {
                await webhook.send(notification, msg, monitorJSON, heartbeatJSON);
                
                // Verify the payload is a proper JavaScript object (not a string)
                assert.strictEqual(typeof capturedData, "object", "Payload should be an object in default mode");
                assert.ok(capturedData.msg, "Payload should contain msg");
                assert.ok(capturedData.heartbeat, "Payload should contain heartbeat");
                assert.ok(capturedData.monitor, "Payload should contain monitor");
                
                // Verify the data can be JSON stringified without errors
                const jsonString = JSON.stringify(capturedData);
                assert.ok(jsonString, "Payload should be JSON serializable");
                
                // Verify the JSON can be parsed back
                const parsed = JSON.parse(jsonString);
                assert.strictEqual(parsed.msg, msg, "Message should round-trip correctly");
                assert.strictEqual(parsed.heartbeat.msg, heartbeatJSON.msg, "Heartbeat message should round-trip correctly");
                
                // Verify newlines are preserved
                assert.ok(parsed.msg.includes("\n"), "Newlines should be preserved in msg");
                assert.ok(parsed.heartbeat.msg.includes("\n"), "Newlines should be preserved in heartbeat.msg");
                
            } finally {
                // Restore axios
                axios.post = originalPost;
            }
        });
        
        test("should handle double quotes in message correctly", async () => {
            const webhook = new Webhook();
            
            const notification = {
                webhookURL: "https://example.com/webhook",
                httpMethod: "post",
            };
            
            // Message with double quotes
            const msg = 'Service "Production API" is down';
            
            const monitorJSON = {
                id: 1,
                name: 'Test "quoted" Monitor',
            };
            
            const heartbeatJSON = {
                status: 0,
                msg: 'Error: "Connection refused" at port 443',
            };
            
            let capturedData = null;
            const originalPost = axios.post;
            axios.post = async (url, data, config) => {
                capturedData = data;
                return { data: { success: true }, status: 200 };
            };
            
            try {
                await webhook.send(notification, msg, monitorJSON, heartbeatJSON);
                
                // Verify JSON serialization works
                const jsonString = JSON.stringify(capturedData);
                const parsed = JSON.parse(jsonString);
                
                assert.strictEqual(parsed.msg, msg, "Message with quotes should round-trip correctly");
                assert.strictEqual(parsed.monitor.name, monitorJSON.name, "Monitor name with quotes should round-trip correctly");
                
            } finally {
                axios.post = originalPost;
            }
        });
        
        test("should handle special characters in custom body template with json_escape filter", async () => {
            const webhook = new Webhook();
            
            const notification = {
                webhookURL: "https://example.com/webhook",
                httpMethod: "post",
                webhookContentType: "custom",
                // Using json_escape filter to properly escape values for JSON strings
                webhookCustomBody: '{"message": "{{msg | json_escape}}", "monitor": "{{monitorJSON.name | json_escape}}"}',
            };
            
            // Message with newlines and quotes
            const msg = 'Error:\n"Connection timeout"\nRetrying...';
            
            const monitorJSON = {
                id: 1,
                name: 'API "Production"',
            };
            
            let capturedData = null;
            const originalPost = axios.post;
            axios.post = async (url, data, config) => {
                capturedData = data;
                return { data: { success: true }, status: 200 };
            };
            
            try {
                await webhook.send(notification, msg, monitorJSON, null);
                
                // The captured data should be a string (rendered template)
                assert.strictEqual(typeof capturedData, "string", "Custom body should be a string");
                
                // The string should be valid JSON
                assert.doesNotThrow(() => {
                    JSON.parse(capturedData);
                }, "Custom body should produce valid JSON");
                
                // Verify the values round-trip correctly
                const parsed = JSON.parse(capturedData);
                assert.strictEqual(parsed.message, msg, "Message should be correctly escaped in JSON");
                assert.strictEqual(parsed.monitor, monitorJSON.name, "Monitor name should be correctly escaped in JSON");
                
            } finally {
                axios.post = originalPost;
            }
        });
    });
});
