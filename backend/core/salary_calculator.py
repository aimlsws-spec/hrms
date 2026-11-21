"""
Salary Calculator Module
Handles CTC breakdown and salary component calculations based on templates
"""

class SalaryCalculator:
    """Calculate salary components based on CTC and template"""
    
    # Salary templates with percentage breakdowns
    TEMPLATES = {
        'standard': {
            'basic': 40,
            'hra': 20,
            'special_allowance': 15,
            'transport_allowance': 5,
            'medical_allowance': 5,
            'pf_employer': 12,
            'pf_employee': 12,
            'professional_tax': 200  # Fixed amount per month
        },
        'executive': {
            'basic': 50,
            'hra': 25,
            'special_allowance': 10,
            'transport_allowance': 3,
            'medical_allowance': 2,
            'pf_employer': 12,
            'pf_employee': 12,
            'professional_tax': 200
        }
    }
    
    @staticmethod
    def calculate_ctc_breakdown(annual_ctc: float, template: str = 'standard') -> dict:
        """
        Calculate salary breakdown from annual CTC
        
        Args:
            annual_ctc: Annual CTC amount
            template: Salary template to use ('standard' or 'executive')
            
        Returns:
            Dictionary with monthly and annual breakdown
        """
        if template not in SalaryCalculator.TEMPLATES:
            template = 'standard'
        
        config = SalaryCalculator.TEMPLATES[template]
        monthly_ctc = annual_ctc / 12
        
        # Calculate components
        basic = (annual_ctc * config['basic']) / 100
        hra = (annual_ctc * config['hra']) / 100
        special_allowance = (annual_ctc * config['special_allowance']) / 100
        transport_allowance = (annual_ctc * config['transport_allowance']) / 100
        medical_allowance = (annual_ctc * config['medical_allowance']) / 100
        
        # PF calculations (on basic)
        pf_employer = (basic * config['pf_employer']) / 100
        pf_employee = (basic * config['pf_employee']) / 100
        
        # Professional tax (monthly fixed)
        professional_tax_monthly = config['professional_tax']
        professional_tax_annual = professional_tax_monthly * 12
        
        # Gross salary (before deductions)
        gross_annual = basic + hra + special_allowance + transport_allowance + medical_allowance
        gross_monthly = gross_annual / 12
        
        # Total deductions
        total_deductions_annual = pf_employee + professional_tax_annual
        total_deductions_monthly = total_deductions_annual / 12
        
        # Net salary (take home)
        net_annual = gross_annual - total_deductions_annual
        net_monthly = net_annual / 12
        
        return {
            'annual': {
                'ctc': round(annual_ctc, 2),
                'basic': round(basic, 2),
                'hra': round(hra, 2),
                'special_allowance': round(special_allowance, 2),
                'transport_allowance': round(transport_allowance, 2),
                'medical_allowance': round(medical_allowance, 2),
                'gross': round(gross_annual, 2),
                'pf_employer': round(pf_employer, 2),
                'pf_employee': round(pf_employee, 2),
                'professional_tax': round(professional_tax_annual, 2),
                'total_deductions': round(total_deductions_annual, 2),
                'net_salary': round(net_annual, 2)
            },
            'monthly': {
                'ctc': round(monthly_ctc, 2),
                'basic': round(basic / 12, 2),
                'hra': round(hra / 12, 2),
                'special_allowance': round(special_allowance / 12, 2),
                'transport_allowance': round(transport_allowance / 12, 2),
                'medical_allowance': round(medical_allowance / 12, 2),
                'gross': round(gross_monthly, 2),
                'pf_employer': round(pf_employer / 12, 2),
                'pf_employee': round(pf_employee / 12, 2),
                'professional_tax': round(professional_tax_monthly, 2),
                'total_deductions': round(total_deductions_monthly, 2),
                'net_salary': round(net_monthly, 2)
            },
            'template': template
        }
    
    @staticmethod
    def calculate_from_basic(basic_salary: float, template: str = 'standard') -> dict:
        """Calculate CTC from basic salary"""
        if template not in SalaryCalculator.TEMPLATES:
            template = 'standard'
        
        config = SalaryCalculator.TEMPLATES[template]
        basic_percentage = config['basic']
        
        # Reverse calculate CTC from basic
        annual_ctc = (basic_salary * 100) / basic_percentage
        
        return SalaryCalculator.calculate_ctc_breakdown(annual_ctc, template)
