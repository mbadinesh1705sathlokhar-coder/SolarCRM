import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  credentials = {
    username: '',
    password: ''
  };

  showPassword = false;
  loading = false;
  errorMessage = '';
  returnUrl = '/home';

  ngOnInit(): void {
    // If already logged in, redirect
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/home']);
      return;
    }

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (!this.credentials.username.trim() || !this.credentials.password) {
      this.errorMessage = 'Please enter both Username/Email and Password.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.credentials).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.errorMessage = res.message || 'Login failed. Please verify your credentials.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Invalid username or password. Please try again.';
      }
    });
  }

  fillAdminCredentials(): void {
    this.credentials.username = 'mbadinesh1705@gmail.com';
    this.credentials.password = 'Pass123';
    this.errorMessage = '';
  }
}
