import time
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class AIChatMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only process AI chat endpoints
        if request.path.startswith('/api/chat/'):
            start_time = time.time()
            
            response = self.get_response(request)
            
            # Log performance metrics
            duration = time.time() - start_time
            logger.info(
                f"AI Chat Request - Path: {request.path}, "
                f"Method: {request.method}, "
                f"Duration: {duration:.2f}s, "
                f"Status: {response.status_code}"
            )
            
            return response
        return self.get_response(request)