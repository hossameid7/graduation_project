from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'transformers', views.TransformerViewSet, basename='transformer')
router.register(r'measurements', views.TransformerMeasurementViewSet, basename='measurement')
router.register(r'support-sessions', views.SupportSessionViewSet, basename='support-session')
router.register(r'support-messages', views.SupportMessageViewSet, basename='support-message')
router.register(r'admin-notifications', views.AdminNotificationViewSet, basename='admin-notification')
router.register(r'chat', views.ChatViewSet, basename='chat')

urlpatterns = [
    path('', include(router.urls)),
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('profile/', views.profile, name='profile'),
    path('change-password/', views.change_password, name='change-password'),
    path('delete-account/', views.delete_account, name='delete-account'),
    path('unread-notifications-count/', views.unread_notifications_count, name='unread-notifications-count'),
    path('transformers/email_report/', views.TransformerViewSet.as_view({'post': 'email_report'}), name='transformer-email-report'),
]