# Deepgram AI Integration Setup Guide

## Overview
This guide will help you set up the Deepgram transcription AI integration with your Yarn meeting platform. The integration provides real-time audio transcription and AI-powered meeting assistance.

## Prerequisites
1. Deepgram API key (get one at https://deepgram.com)
2. OpenAI API key (get one at https://openai.com)
3. Node.js and npm installed

## Backend Setup

### 1. Install Dependencies
```bash
cd yarn/server
npm install
```

### 2. Environment Configuration
Create a `.env` file in the `yarn/server/` directory:

```env
# Server Configuration
PORT=5174
CLIENT_ORIGIN=http://localhost:8080

# Deepgram API Key for real-time transcription
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# OpenAI API Key for AI chat responses
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Start the Backend Server
```bash
cd yarn/server
npm run dev
```

## Frontend Setup

### 1. Install Dependencies
```bash
cd yarn
npm install
```

### 2. Environment Configuration
Create a `.env` file in the `yarn/` directory:

```env
# Backend URL for local development
VITE_SERVER_URL=http://localhost:5174
```

### 3. Start the Frontend
```bash
cd yarn
npm run dev
```

## Features

### Real-time Transcription
- **Automatic Audio Capture**: Captures audio from all participants
- **Live Transcription**: Real-time speech-to-text using Deepgram's Nova-2 model
- **Speaker Diarization**: Identifies different speakers
- **Confidence Scoring**: Shows transcription confidence levels
- **Smart Formatting**: Automatic punctuation and formatting

### AI-Powered Meeting Assistant (Olio)
- **Context-Aware Responses**: AI understands the meeting conversation
- **Real-time Q&A**: Ask questions about the meeting as it happens
- **Meeting Memory**: Remembers conversation context throughout the meeting
- **Intelligent Summarization**: Provides insights based on transcribed content

### User Interface
- **Transcription Tab**: View real-time meeting transcription
- **AI Chat Tab**: Interact with Olio, the AI assistant
- **Regular Chat Tab**: Traditional participant chat
- **Participants Tab**: View meeting participants

## How It Works

### Audio Flow
1. **Audio Capture**: Frontend captures audio from user's microphone
2. **Audio Processing**: Audio is converted to the optimal format for Deepgram
3. **Real-time Streaming**: Audio data is streamed to the backend via Socket.IO
4. **Deepgram Processing**: Backend sends audio to Deepgram for transcription
5. **Transcription Updates**: Real-time transcription results are sent to all participants

### AI Flow
1. **Context Building**: Meeting transcription is stored and processed
2. **Question Processing**: User questions are sent to OpenAI with meeting context
3. **Intelligent Responses**: AI generates responses based on meeting content
4. **Real-time Updates**: AI responses are shared with all participants

## API Endpoints

### Socket.IO Events

#### Client → Server
- `room:join` - Join a meeting room
- `room:leave` - Leave a meeting room
- `audio:stream` - Stream audio data for transcription
- `ai:question` - Ask AI a question about the meeting
- `transcription:get` - Get transcription history
- `ai:questions:get` - Get AI questions history

#### Server → Client
- `participants:update` - Update participant list
- `transcription:update` - Real-time transcription updates
- `transcription:history` - Full transcription history
- `ai:answer` - AI response to user question
- `ai:question-asked` - Broadcast AI Q&A to all participants
- `ai:questions` - AI questions history

## Configuration Options

### Audio Capture Settings
```typescript
const audioOptions = {
  sampleRate: 16000,    // Optimal for Deepgram
  channels: 1,          // Mono audio
  bufferSize: 4096      // Buffer size for processing
};
```

### Deepgram Model Settings
```typescript
const deepgramConfig = {
  model: "nova-2",      // Latest Deepgram model
  language: "en",       // English language
  smart_format: true,   // Smart formatting
  interim_results: true, // Real-time results
  punctuate: true,      // Automatic punctuation
  diarize: true         // Speaker identification
};
```

## Troubleshooting

### Common Issues

1. **Audio Not Capturing**
   - Check browser permissions for microphone access
   - Ensure HTTPS in production (required for microphone access)
   - Check browser console for errors

2. **Transcription Not Working**
   - Verify Deepgram API key is correct
   - Check backend logs for Deepgram connection errors
   - Ensure audio is being captured and sent

3. **AI Not Responding**
   - Verify OpenAI API key is correct
   - Check if there's meeting context (transcription)
   - Check backend logs for OpenAI API errors

4. **Connection Issues**
   - Verify backend server is running on correct port
   - Check CORS settings in backend
   - Ensure frontend is connecting to correct backend URL

### Debug Mode
Enable debug logging by checking browser console and backend terminal for detailed error messages.

## Production Deployment

### Environment Variables
Set the following environment variables in your production environment:

```env
# Backend
PORT=5174
CLIENT_ORIGIN=https://your-frontend-domain.com
DEEPGRAM_API_KEY=your_production_deepgram_key
OPENAI_API_KEY=your_production_openai_key

# Frontend
VITE_SERVER_URL=https://your-backend-domain.com
```

### Security Considerations
- Keep API keys secure and never commit them to version control
- Use environment variables for all sensitive configuration
- Implement proper CORS settings for production
- Consider rate limiting for AI API calls

## Cost Considerations

### Deepgram Pricing
- Pay per minute of audio processed
- Nova-2 model offers high accuracy
- Consider usage patterns for cost optimization

### OpenAI Pricing
- Pay per token for GPT-4 API calls
- Monitor usage to avoid unexpected costs
- Consider implementing usage limits

## Support

For issues with:
- **Deepgram**: Check [Deepgram Documentation](https://developers.deepgram.com/)
- **OpenAI**: Check [OpenAI API Documentation](https://platform.openai.com/docs)
- **This Integration**: Check the code comments and error logs
