from django.test import TestCase
from django.contrib.auth.models import User
from .models import Transformer, TransformerMeasurement

class TransformerMeasurementTests(TestCase):
    def setUp(self):
        # Create a test user and transformer
        self.user = User.objects.create_user(username='testuser', password='12345')
        self.transformer = Transformer.objects.create(user=self.user, name='test_transformer')

    def test_compute_fdd_rul_with_different_inputs(self):
        # Test case 1: [0,0,1,1]
        measurement1 = TransformerMeasurement(
            transformer=self.transformer,
            h2=0,
            co=0,
            c2h2=1,
            c2h4=1
        )
        measurement1.compute_fdd_rul()
        print(f"Test case 1 [0,0,1,1] - FDD: {measurement1.fdd}, RUL: {measurement1.rul}")

        # Test case 2: [1,1,0,0]
        measurement2 = TransformerMeasurement(
            transformer=self.transformer,
            h2=1,
            co=1,
            c2h2=0,
            c2h4=0
        )
        measurement2.compute_fdd_rul()
        print(f"Test case 2 [1,1,0,0] - FDD: {measurement2.fdd}, RUL: {measurement2.rul}")
        # Test case 2: [1,1,0,0]
        measurement3 = TransformerMeasurement(
            transformer=self.transformer,
            h2=0,
            co=0,
            c2h2=0,
            c2h4=1
        )
        measurement3.compute_fdd_rul()
        print(f"Test case ERROR  [0,0,0,1] - FDD: {measurement3.fdd}, RUL: {measurement3.rul}")

        measurement4 = TransformerMeasurement(
            transformer=self.transformer,
            h2=0,
            co=0,
            c2h2=1,
            c2h4=1
        )
        measurement4.compute_fdd_rul()
        print(f"Test case 2 [0,0,0,1] - FDD: {measurement4.fdd}, RUL: {measurement4.rul}")




        measurement5 = TransformerMeasurement(
            transformer=self.transformer,
            h2=5,
            co=10,
            c2h2=0,
            c2h4=2
        )
        measurement5.compute_fdd_rul()
        print(f"Test case 2 [0,0,0,1] - FDD: {measurement5.fdd}, RUL: {measurement5.rul}")




        measurement6 = TransformerMeasurement(
            transformer=self.transformer,
            h2=-6,
            co=-8,
            c2h2=-56,
            c2h4=-11
        )
        measurement6.compute_fdd_rul()
        print(f"Test case 2 [0,0,0,1] - FDD: {measurement6.fdd}, RUL: {measurement6.rul}")




