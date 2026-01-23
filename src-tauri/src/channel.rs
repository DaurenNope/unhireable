use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::Mutex;

pub type Message = serde_json::Value;

#[derive(Clone)]
pub struct Channel<T> {
    sender: mpsc::UnboundedSender<T>,
    receiver: Arc<Mutex<mpsc::UnboundedReceiver<T>>>,
}

impl<T> Channel<T> {
    pub fn new() -> (Self, Self) {
        let (tx, rx) = mpsc::unbounded_channel();
        let (tx2, rx2) = mpsc::unbounded_channel();
        
        (
            Channel {
                sender: tx,
                receiver: Arc::new(Mutex::new(rx2)),
            },
            Channel {
                sender: tx2,
                receiver: Arc::new(Mutex::new(rx)),
            },
        )
    }

    pub fn send(&self, message: T) -> Result<()>
    where
        T: Send,
    {
        self.sender.send(message).map_err(|e| anyhow::anyhow!("Send error: {:?}", e))?;
        Ok(())
    }

    pub async fn receive(&self) -> Option<T> {
        let mut receiver = self.receiver.lock().await;
        receiver.recv().await
    }

    pub fn try_receive(&self) -> Option<T> {
        let mut receiver = self.receiver.try_lock().ok()?;
        receiver.try_recv().ok()
    }
}

pub struct ChannelManager {
    channels: Arc<Mutex<std::collections::HashMap<String, Channel<Message>>>>,
}

impl ChannelManager {
    pub fn new() -> Self {
        ChannelManager {
            channels: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub async fn create_channel(&self, name: String) -> (Channel<Message>, Channel<Message>) {
        let (ch1, ch2) = Channel::new();
        let mut channels = self.channels.lock().await;
        channels.insert(name.clone(), ch1.clone());
        (ch1, ch2)
    }

    pub async fn get_channel(&self, name: &str) -> Option<Channel<Message>> {
        let channels = self.channels.lock().await;
        channels.get(name).cloned()
    }

    pub async fn send_message(&self, channel_name: &str, message: Message) -> Result<()> {
        let channels = self.channels.lock().await;
        if let Some(channel) = channels.get(channel_name) {
            channel.send(message)?;
        }
        Ok(())
    }
}

