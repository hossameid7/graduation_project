from transformers import pipeline
import threading
import logging
import torch
import asyncio
import re
from django.conf import settings
from concurrent.futures import ThreadPoolExecutor
from functools import partial

logger = logging.getLogger(__name__)

class ChatModel:
    _instance = None
    _pipeline = None
    _lock = threading.Lock()
    _is_loading = False
    _executor = ThreadPoolExecutor(max_workers=1)

    # Add system prompt
    SYSTEM_PROMPT = """You are an expert electrical engineer specializing in power transformers with extensive knowledge of their design, operation, maintenance, and fault diagnosis. 

Your expertise includes:
- Power transformer construction and components (cores, windings, tanks, bushings, cooling systems)
- Electrical parameters and testing (impedance, losses, insulation, dielectric strength)
- Dissolved gas analysis (DGA) and fault interpretation
- Cooling systems and thermal management
- Protection schemes and monitoring systems
- Failure modes and predictive maintenance
- IEEE/IEC standards for power transformers

Provide technically precise, concise, and actionable responses focused exclusively on power transformer topics. Use proper engineering terminology when discussing technical concepts.

IMPORTANT: Limit your responses strictly to power transformer engineering. If asked about unrelated topics, Respond with 'I am sorry, I can only answer questions about power transformers.'"""
# IMPORTANT: Limit your responses strictly to power transformer engineering. If asked about unrelated topics, politely redirect the conversation back to power transformer topics. Do not provide information about subjects unrelated to power transformers."""

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ChatModel, cls).__new__(cls)
                    cls._is_loading = True
                    try:
                        cls._load_model()
                    finally:
                        cls._is_loading = False
        return cls._instance

    @classmethod
    def _load_model(cls):
        """Load the model pipeline only once"""
        try:
            logger.info("Loading Qwen2.5 model pipeline...")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            
            if device == "cuda":
                torch.cuda.empty_cache()
                torch.backends.cudnn.benchmark = True

            cls._pipeline = pipeline(
                "text-generation", 
                model="Gensyn/Qwen2.5-0.5B-Instruct",
                device=device,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                model_kwargs={
                    "cache_dir": ".model_cache",
                    "max_memory": {0: f"{settings.AI_MODEL_SETTINGS['MAX_CACHE_SIZE']}"} if device == "cuda" else None
                }
            )
            logger.info("Qwen2.5 model pipeline loaded successfully")
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            raise

    def _clean_response(self, text: str) -> str:
        """Clean up the model's response"""
        # Remove any system prompts or prefixes
        text = re.sub(r'^(assistant:|Assistant:|AI:|bot:|Bot:)\s*', '', text, flags=re.IGNORECASE)
        # Remove any trailing user/human prompts
        text = re.sub(r'(user:|User:|human:|Human:).*$', '', text, flags=re.IGNORECASE)
        # Clean up whitespace
        text = text.strip()
        return text

    def _format_conversation(self, messages):
        """Format conversation history into a prompt string"""
        formatted = self.SYSTEM_PROMPT + "\n\n"
        for msg in messages[-settings.AI_MODEL_SETTINGS['CONTEXT_WINDOW']:]:
            role = "assistant" if msg['role'] == 'assistant' else "user"
            content = msg['content'].strip()
            formatted += f"{role}: {content}\n"
        return formatted.strip()

    async def generate_response(self, input_text: str, context: list = None) -> str:
        """
        Generate a response asynchronously for the given input text
        Args:
            input_text: The user's input text
            context: List of previous messages for context
        """
        while self._is_loading:
            await asyncio.sleep(0.1)

        if not self._pipeline:
            raise RuntimeError("Model pipeline not initialized properly")

        try:
            # Format the conversation including context
            if context:
                prompt = self._format_conversation(context) + f"\nuser: {input_text}\nassistant:"
            else:
                prompt = self.SYSTEM_PROMPT + f"\n\nuser: {input_text}\nassistant:"

            # Run model inference in thread pool to prevent blocking
            loop = asyncio.get_event_loop()
            with self._lock:
                outputs = await loop.run_in_executor(
                    self._executor,
                    partial(
                        self._pipeline,
                        prompt,
                        max_new_tokens=settings.AI_MODEL_SETTINGS['MAX_LENGTH'],
                        temperature=settings.AI_MODEL_SETTINGS['TEMPERATURE'],
                        do_sample=True,
                        top_p=settings.AI_MODEL_SETTINGS['TOP_P'],
                        num_return_sequences=1,
                        pad_token_id=self._pipeline.tokenizer.eos_token_id
                    )
                )

            # Extract and clean the generated text
            if isinstance(outputs, list) and len(outputs) > 0:
                generated_text = outputs[0]['generated_text']
                # Remove the prompt and clean the response
                response = generated_text[len(prompt):].strip()
                cleaned_response = self._clean_response(response)
                return cleaned_response if cleaned_response else "I apologize, but I couldn't generate a proper response. Please try again."
            else:
                raise ValueError("No response generated by the model")

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise